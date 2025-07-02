import { Server, Socket } from 'socket.io';

interface UserPayload {
  _id: string;
  type: 'host' | 'candidate';
}

interface JoinPayload {
  examid: string;
  user: UserPayload;
}

interface SignalPayload {
  to: string;
  from: string;
  signal: any;
}

interface WarningPayload {
  to: string;
  message: string;
}

interface CandidateData {
  userId: string;
  joinTime: Date;
  warnings: number;
}

interface ExamMonitoring {
  host: string | null;
  candidates: Map<string, CandidateData>;
  warnings: Map<string, number>;
}

interface ClientData extends JoinPayload {
  socketid: string;
}

interface Clients {
  [examid: string]: ClientData[];
}

interface SocketRoomMap {
  [socketid: string]: string;
}

interface ExamMonitoringMap {
  [examid: string]: ExamMonitoring;
}

let clients: Clients = {};
let socketRoomidMap: SocketRoomMap = {};
let examMonitoring: ExamMonitoringMap = {};

const SocketHelper = (io: Server): void => {
  io.on('connection', (socket: Socket) => {
    socket.on('join_room', (payload: JoinPayload) => {
      socket.join(payload.examid);

      // Initialize exam monitoring if not exists
      if (!examMonitoring[payload.examid]) {
        examMonitoring[payload.examid] = {
          host: null,
          candidates: new Map(),
          warnings: new Map(),
        };
      }

      if (clients[payload.examid]) {
        if (
          clients[payload.examid].find(
            (v) => String(v.user._id) === String(payload.user._id)
          )
        ) {
          clients[payload.examid].forEach((v, idx) => {
            if (String(v.user._id) === String(payload.user._id)) {
              let x = clients[payload.examid][idx];
              x.socketid = socket.id;
              clients[payload.examid][idx] = x;
            }
          });
        } else {
          clients[payload.examid].push({ ...payload, socketid: socket.id });
        }
      } else {
        clients[payload.examid] = [{ ...payload, socketid: socket.id }];
      }

      socketRoomidMap[socket.id] = payload.examid;

      // Track candidate or host
      if (payload.user.type === 'host') {
        examMonitoring[payload.examid].host = socket.id;
        let x = clients[payload.examid].filter((v) => v.user.type !== 'host');
        io.to(socket.id).emit('user_list', x);
      } else {
        examMonitoring[payload.examid].candidates.set(socket.id, {
          userId: payload.user._id,
          joinTime: new Date(),
          warnings: 0,
        });
      }
    });

    socket.on('new_join', () => {
      let x = clients[socketRoomidMap[socket.id]]?.find(
        (v) => String(v.socketid) === String(socket.id)
      );
      socket.to(socketRoomidMap[socket.id]).emit('user_joined', x);
    });

    // WebRTC signaling
    socket.on('sending_signal', (payload: SignalPayload) => {
      socket.to(payload.to).emit('receive_signal', {
        signal: payload.signal,
        from: payload.from,
      });
    });

    socket.on('send_signal', (payload: SignalPayload) => {
      socket.to(payload.to).emit('receiving_returned_signal', {
        signal: payload.signal,
        from: socket.id,
      });
    });

    // Warning system
    socket.on('send_warning', (payload: WarningPayload) => {
      const examId = socketRoomidMap[socket.id];
      const monitoring = examMonitoring[examId];
      
      if (monitoring && monitoring.host === socket.id) {
        const candidateData = monitoring.candidates.get(payload.to);
        if (candidateData) {
          candidateData.warnings += 1;
          monitoring.candidates.set(payload.to, candidateData);
          
          // Send warning to candidate
          io.to(payload.to).emit('warning_received', {
            message: payload.message,
            warningCount: candidateData.warnings,
          });

          // If warnings exceed threshold, notify host
          if (candidateData.warnings >= 3) {
            io.to(monitoring.host).emit('excessive_warnings', {
              candidateId: candidateData.userId,
              warningCount: candidateData.warnings,
            });
          }
        }
      }
    });

    socket.on('disconnect', () => {
      let arr = clients[socketRoomidMap[socket.id]];
      if (arr) {
        clients[socketRoomidMap[socket.id]] = arr.filter((v) => {
          if (String(v.socketid) !== String(socket.id)) {
            return true;
          } else {
            socket.to(v.examid).emit('user_left', socket.id);
            socket.leave(v.examid);

            // Clean up monitoring data
            const examId = socketRoomidMap[socket.id];
            if (examMonitoring[examId]) {
              if (examMonitoring[examId].host === socket.id) {
                delete examMonitoring[examId];
              } else {
                examMonitoring[examId].candidates.delete(socket.id);
              }
            }

            return false;
          }
        });

        if (clients[socketRoomidMap[socket.id]].length === 0) {
          delete clients[socketRoomidMap[socket.id]];
        }
        delete socketRoomidMap[socket.id];
      }
    });
  });
};

export default SocketHelper; 
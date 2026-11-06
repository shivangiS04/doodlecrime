import { customAlphabet } from "nanoid";
import { Room, RoomCallbacks } from "./gameEngine";

// Unambiguous alphabet: no 0/O, 1/I/L confusion.
const generateCode = customAlphabet("ABCDEFGHJKMNPQRSTUVWXYZ23456789", 6);

class RoomStore {
  private rooms: Map<string, Room> = new Map();

  createRoom(makeCallbacks: (code: string) => RoomCallbacks): Room {
    let code = generateCode();
    while (this.rooms.has(code)) code = generateCode();
    const room = new Room(code, makeCallbacks(code));
    this.rooms.set(code, room);
    return room;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  deleteIfEmpty(code: string) {
    const room = this.rooms.get(code);
    if (room && room.players.size === 0) {
      room.destroy();
      this.rooms.delete(code);
    }
  }
}

// Survives tsx watch module reloads in dev via globalThis.
const globalKey = "__doodleCrimesRoomStore__";
export const roomStore: RoomStore =
  (globalThis as any)[globalKey] ?? ((globalThis as any)[globalKey] = new RoomStore());

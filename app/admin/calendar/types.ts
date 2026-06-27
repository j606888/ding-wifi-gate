import { DoorCode } from "../shared";

// 某天的單一開放時段（已綁定到一組密碼）。
export type DayEntry = {
  code: DoorCode;
  startMinute: number;
  endMinute: number;
};

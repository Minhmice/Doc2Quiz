import {
  API_STATUS_CHECKING,
  API_STATUS_DOWN,
  API_STATUS_IDLE_OK,
  API_STATUS_NOT_WIRED,
  API_STATUS_SUCCESS,
  type ApiStatusClickLevel,
} from "../../../dictionary/ApiStatusSpam_Lines";

export const API_STATUS_SPAM_MAX_LEVEL = 3;

function pickRandom(items: readonly string[]): string {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function clickLevelFromCount(count: number): ApiStatusClickLevel {
  if (count <= 1) {
    return 1;
  }
  if (count === 2) {
    return 2;
  }
  return 3;
}

export function pickCheckingLine(level: ApiStatusClickLevel): string {
  return pickRandom(API_STATUS_CHECKING[level]);
}

export function pickSuccessLine(level: ApiStatusClickLevel): string {
  return pickRandom(API_STATUS_SUCCESS[level]);
}

export function pickIdleOkLine(): string {
  return pickRandom(API_STATUS_IDLE_OK);
}

export function pickNotWiredLine(): string {
  return pickRandom(API_STATUS_NOT_WIRED);
}

export function pickDownLine(): string {
  return pickRandom(API_STATUS_DOWN);
}

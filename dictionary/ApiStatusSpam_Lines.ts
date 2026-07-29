/**
 * AI status pill copy — shown ON the pill (no tooltip).
 * Each phase × level: 5 Vietnamese + 5 English (10 variants), picked at random.
 */

export type ApiStatusClickLevel = 1 | 2 | 3;

/** While a user-initiated ping is in flight. */
export const API_STATUS_CHECKING: Record<
  ApiStatusClickLevel,
  readonly string[]
> = {
  1: [
    "đang check rồi thằng l",
    "checking rồi bro chill",
    "đợi tí đang ping",
    "hold up im pinging",
    "check cái gì mà hối",
    "relax im checking",
    "ping đang chạy kìa",
    "one sec checking",
    "đừng bấm nữa đang check",
    "chill bro checking",
  ],
  2: [
    "check nhiều thế thằng l",
    "bro why u clicking again",
    "lại check à thằng l",
    "still checking chill",
    "spam ping luôn á",
    "u really clicked again",
    "đang check lần 2 nè",
    "second check incoming",
    "bấm hoài vậy ba",
    "again? fine checking",
  ],
  3: [
    "đừng check nữa thằng l ơi",
    "stop clicking im fine",
    "đủ rồi đừng bấm nữa",
    "bro im still online",
    "check hoài quá vậy",
    "leave me alone chat",
    "thôi đừng spam ping",
    "third time. touch grass",
    "đừng có mà bấm nữa",
    "pls stop poking me",
  ],
};

/** After a successful user-initiated ping. */
export const API_STATUS_SUCCESS: Record<
  ApiStatusClickLevel,
  readonly string[]
> = {
  1: [
    "bố mày chạy ngon con ơi",
    "we good bro lock in",
    "chạy ngon vl con ơi",
    "model's up no cap",
    "online roi yên tâm",
    "brain online trust",
    "ngon lành cành đào",
    "all green chat",
    "sống như cá hồi",
    "pong received lol",
  ],
  2: [
    "bố vẫn chạy ngon con ơi",
    "still smooth bro",
    "vẫn ngon mà lo gì",
    "yeah still online",
    "check nhiều thế thằng l",
    "still up stop poking",
    "vẫn sống kìa ba",
    "second ping still ok",
    "ngon như lần 1",
    "still cooking trust",
  ],
  3: [
    "bố chạy ngon mà con ơi huuhuhu",
    "im fine stop clicking huuhu",
    "vẫn ngon mà đừng bấm",
    "online still bro sob",
    "đừng check nữa ngon mà",
    "pls im begging online",
    "ngon mà sao bấm hoài",
    "still alive cry emoji",
    "chạy ngon huuhuhu",
    "respectfully still up",
  ],
};

/** Calm pill before any user click (post background ping). */
export const API_STATUS_IDLE_OK: readonly string[] = [
  "Sống",
  "Live",
  "Online",
  "OK",
  "Ngon",
  "Ready",
  "Chạy ngon",
  "All good",
  "Up",
  "Ổn",
];

export const API_STATUS_NOT_WIRED: readonly string[] = [
  "Chưa cấu hình",
  "Not wired",
  "Thiếu .env",
  "No API key",
  "Chưa setup",
  "Missing env",
  "Chưa có key",
  "Setup .env",
  "Chưa kết nối",
  "No provider",
];

export const API_STATUS_DOWN: readonly string[] = [
  "Down",
  "Offline",
  "Không lên",
  "Mất rồi",
  "Rip ping",
  "Try again",
  "Bấm lại",
  "Không được",
  "Fail",
  "Down bad",
];

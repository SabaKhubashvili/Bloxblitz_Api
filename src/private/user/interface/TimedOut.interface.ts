
export interface TimedOutDataInterface {
  isTimedOut: boolean;
  canChat: boolean;
  message: string;
  timeLeft?: string;
  reason?: string;
  mutedBy?: string;
  expiration?: string;
}


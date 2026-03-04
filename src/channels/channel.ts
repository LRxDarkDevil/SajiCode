export interface ChannelMessage {
  channel: string;
  senderId: string;
  senderName: string;
  text: string;
  threadId: string;
  timestamp: number;
  reply: (text: string) => Promise<void>;
}

export interface ChannelAdapter {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  onMessage(handler: (msg: ChannelMessage) => void): void;
}

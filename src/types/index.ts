import { Tables } from "./database.types";

export type User = Tables<'users'>;
export type Channel = Tables<'channels'>;

export type ChannelWithUsers = Channel & { users: User[] };

export type Message_Recipients = Tables<'message_recipients'>
export type Messages = Tables<'messages'>;

export type MessageWithRecipients = Messages & { message_recipients: Message_Recipients[] }


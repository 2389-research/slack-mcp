export interface SlackUser {
    id: string;
    email: string;
    name: string;
    real_name: string;
}
export interface ChannelInfo {
    id: string;
    name: string;
}
export interface MessageInfo {
    ts: string;
    channel: string;
}
export declare class SlackClient {
    private client;
    private userCache;
    constructor(token: string);
    /**
     * Create a new channel (public or private)
     */
    createChannel(name: string, isPrivate?: boolean, description?: string): Promise<ChannelInfo>;
    /**
     * Invite users to a channel by email or user ID
     */
    inviteToChannel(channelId: string, users: string[]): Promise<{
        invited: string[];
        failed: string[];
    }>;
    /**
     * Post a message to a channel
     */
    postMessage(channelId: string, text: string, blocks?: any[]): Promise<MessageInfo>;
    /**
     * Reply to a message in a thread
     */
    postThread(channelId: string, threadTs: string, text: string): Promise<MessageInfo>;
    /**
     * Pin a message to a channel
     */
    pinMessage(channelId: string, messageTs: string): Promise<boolean>;
    /**
     * List all users in the workspace
     */
    listUsers(): Promise<SlackUser[]>;
    /**
     * Look up a user ID by email
     */
    getUserIdByEmail(email: string): Promise<string | null>;
}

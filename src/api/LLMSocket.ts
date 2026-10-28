/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Thin singleton wrapper around the WebSocket connection to the local LLM
 * backend. The chat UI only talks to this class, so the wire protocol can
 * evolve without touching any component.
 *
 * Wire protocol (JSON, version 1):
 *   Client -> Server: { type: 'chat', id, text, attachments: IChatAttachment[] }
 *   Server -> Client: { type: 'chat', id?, text }
 *                     { type: 'status', text }
 *                     { type: 'error', text }
 */

// Types
import { TDragEntityKind } from '@/util/DragPayload';

// Utility
import Config from '@/config';

export type TChatStatus = 'disconnected' | 'connecting' | 'connected';

export type TChatRole = 'user' | 'assistant' | 'system';

export interface IChatAttachment {
    kind: TDragEntityKind;
    id: string;
    name: string;
    subtitle?: string;
    /** Arbitrary metadata forwarded to the LLM backend (tracks, dates, ...) */
    meta: Record<string, unknown>;
    /** True while additional metadata (e.g. playlist tracks) is being fetched */
    isLoading?: boolean;
}

export interface IChatMessage {
    id: string;
    role: TChatRole;
    text: string;
    attachments?: IChatAttachment[];
    timestamp: number;
}

interface IServerMessage {
    type: 'chat' | 'status' | 'error';
    id?: string;
    text?: string;
}

/**
 * LLMSocket manages a single WebSocket connection to the LLM backend.
 * Components register handlers instead of touching the socket directly.
 */
class LLMSocket {
    private static socket: WebSocket | null = null;

    // Handlers registered by the chat UI
    public static onStatus: ((status: TChatStatus) => void) | null = null;
    public static onMessage: ((message: IChatMessage) => void) | null = null;
    public static onError: ((text: string) => void) | null = null;

    /**
     * Whether the socket is currently open.
     */
    public static readonly isOpen = (): boolean => {
        return LLMSocket.socket !== null && LLMSocket.socket.readyState === WebSocket.OPEN;
    };

    /**
     * Opens a connection to the given WebSocket URL. An existing connection
     * is closed first.
     * @param url - The WebSocket URL of the LLM backend.
     */
    public static readonly connect = (url: string = Config.chat.defaultWebSocketURL): void => {
        LLMSocket.disconnect();
        LLMSocket.onStatus?.('connecting');

        let socket: WebSocket;
        try {
            socket = new WebSocket(url);
        } catch (e) {
            console.error(e);
            LLMSocket.onStatus?.('disconnected');
            LLMSocket.onError?.(e instanceof Error ? e.message : String(e));
            return;
        }
        LLMSocket.socket = socket;

        socket.onopen = () => {
            if (LLMSocket.socket !== socket) return;
            LLMSocket.onStatus?.('connected');
        };

        socket.onclose = () => {
            if (LLMSocket.socket !== socket) return;
            LLMSocket.socket = null;
            LLMSocket.onStatus?.('disconnected');
        };

        socket.onerror = () => {
            if (LLMSocket.socket !== socket) return;
            LLMSocket.onError?.('WebSocket error');
        };

        socket.onmessage = (event: MessageEvent) => {
            if (LLMSocket.socket !== socket) return;
            LLMSocket.handleServerMessage(event.data as string);
        };
    };

    /**
     * Closes the connection if one is open.
     */
    public static readonly disconnect = (): void => {
        if (LLMSocket.socket === null) return;
        const socket = LLMSocket.socket;
        LLMSocket.socket = null;
        socket.close();
        LLMSocket.onStatus?.('disconnected');
    };

    /**
     * Sends a chat message with its attachments to the backend.
     * @param message - The chat message to send.
     * @returns True if the message was sent.
     */
    public static readonly send = (message: IChatMessage): boolean => {
        if (!LLMSocket.isOpen()) return false;

        LLMSocket.socket!.send(
            JSON.stringify({
                type: 'chat',
                version: Config.chat.protocolVersion,
                id: message.id,
                text: message.text,
                attachments: message.attachments ?? [],
            }),
        );
        return true;
    };

    /**
     * Parses an incoming server message and forwards it to the handlers.
     * @param data - The raw message payload.
     */
    private static readonly handleServerMessage = (data: string): void => {
        let parsed: IServerMessage;
        try {
            parsed = JSON.parse(data) as IServerMessage;
        } catch {
            // Tolerate plain-text backends during development
            parsed = { type: 'chat', text: data };
        }

        if (parsed.type === 'error') {
            LLMSocket.onError?.(parsed.text ?? 'Unknown backend error');
            return;
        }

        LLMSocket.onMessage?.({
            id: parsed.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: parsed.type === 'status' ? 'system' : 'assistant',
            text: parsed.text ?? '',
            timestamp: Date.now(),
        });
    };
}

export default LLMSocket;

/**
 * @license
 * Copyright (c) 2026. All rights reserved.
 *
 * Spotify Library Manager
 * Chat panel for the local LLM backend. Playlists, tracks and album variants
 * can be dragged in; they become metadata attachments that are sent along
 * with the next message.
 */

// React imports
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

// Components
import Icon from '@/components/Icon';
import IconButton from '@/components/IconButton';

// Context
import { useGlobalContext } from '@/withGlobalContext';

// API
import LLMSocket, { IChatAttachment, IChatMessage } from '@/api/LLMSocket';
import SpotifyAPI from '@/api/SpotifyAPI';

// Utility
import Config from '@/config';
import StorageHandler from '@/util/StorageHandler';
import { readDragEntity, dragHasType, ENTITY_MIME } from '@/util/DragPayload';

// Style
import './_style/ChatPanel.scss';

interface IChatPanelState {
    draft: string;
    isDragOver: boolean;
    showSettings: boolean;
    wsUrl: string;
}

const ChatPanel: React.FC = () => {
    // Translation
    const { t } = useTranslation('app', { keyPrefix: 'chat' });

    // Context
    const {
        chatOpen: [chatOpen, setChatOpen],
        chatStatus: [chatStatus, setChatStatus],
        chatMessages: [chatMessages, setChatMessages],
        chatAttachments: [chatAttachments, setChatAttachments],
    } = useGlobalContext();

    // State
    const [draft, setDraft] = useState<IChatPanelState['draft']>('');
    const [isDragOver, setIsDragOver] = useState<IChatPanelState['isDragOver']>(false);
    const [showSettings, setShowSettings] = useState<IChatPanelState['showSettings']>(false);
    const [wsUrl, setWsUrl] = useState<IChatPanelState['wsUrl']>(
        (StorageHandler.get('settings.chat.wsUrl', Config.chat.defaultWebSocketURL) as string) ??
            Config.chat.defaultWebSocketURL,
    );

    // Refs
    const messageEndRef = useRef<HTMLDivElement>(null);

    // Wire the socket handlers to the chat state
    useEffect(() => {
        LLMSocket.onStatus = (status) => setChatStatus(status);
        LLMSocket.onMessage = (message) => setChatMessages((current) => [...current, message]);
        LLMSocket.onError = (text) => toast.error(t('backend-error', { text }));

        return () => {
            LLMSocket.onStatus = null;
            LLMSocket.onMessage = null;
            LLMSocket.onError = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, chatAttachments]);

    // Handler functions
    const handleDrop = async (e: React.DragEvent) => {
        setIsDragOver(false);
        const entity = readDragEntity(e);
        if (!entity) return;
        e.preventDefault();

        const attachment: IChatAttachment = {
            kind: entity.kind,
            id: entity.id,
            name: entity.name,
            subtitle: entity.subtitle,
            meta: entity.meta,
            // Playlists get their track metadata resolved in the background
            isLoading: entity.kind === 'playlist',
        };
        setChatAttachments((current) =>
            current.some((existing) => existing.kind === attachment.kind && existing.id === attachment.id)
                ? current
                : [...current, attachment],
        );

        if (entity.kind !== 'playlist') return;

        try {
            const tracks = await SpotifyAPI.fetchPlaylistTracks(entity.id);
            setChatAttachments((current) =>
                current.map((existing) =>
                    existing.kind === 'playlist' && existing.id === entity.id
                        ? {
                              ...existing,
                              isLoading: false,
                              meta: {
                                  ...existing.meta,
                                  tracks: tracks.map((track) => ({
                                      name: track.name,
                                      artists: track.artistNames,
                                      album: track.albumName,
                                      releaseDate: track.releaseDate,
                                      releaseDatePrecision: track.releaseDatePrecision,
                                      uri: track.uri,
                                  })),
                              },
                          }
                        : existing,
                ),
            );
        } catch (err) {
            console.error(err);
            toast.error(t('attachment.load-failed', { name: entity.name }));
            setChatAttachments((current) =>
                current.map((existing) =>
                    existing.kind === 'playlist' && existing.id === entity.id
                        ? { ...existing, isLoading: false }
                        : existing,
                ),
            );
        }
    };

    const handleSend = () => {
        const text = draft.trim();
        if (!text && chatAttachments.length === 0) return;

        if (!LLMSocket.isOpen()) {
            toast.error(t('not-connected'));
            return;
        }

        const message: IChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            role: 'user',
            text,
            attachments: chatAttachments,
            timestamp: Date.now(),
        };

        if (!LLMSocket.send(message)) {
            toast.error(t('send-failed'));
            return;
        }

        setChatMessages((current) => [...current, message]);
        setChatAttachments([]);
        setDraft('');
    };

    if (!chatOpen) return null;

    return (
        <aside
            id='chat-panel'
            className={isDragOver ? 'drag-over' : ''}
            onDragOver={(e) => {
                if (!dragHasType(e, ENTITY_MIME)) return;
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={(e) => {
                if (e.currentTarget === e.target) setIsDragOver(false);
            }}
            onDrop={handleDrop}
        >
            <header id='chat-header'>
                <span className={`status-dot status-${chatStatus}`} title={t(`status.${chatStatus}`)} />
                <span id='chat-title'>{t('title')}</span>
                <span id='chat-status-label'>{t(`status.${chatStatus}`)}</span>

                <IconButton
                    hideBorder
                    icon='sliders'
                    size='tiny'
                    theme='ghost'
                    title={t('settings-tooltip')}
                    onClick={() => setShowSettings((current) => !current)}
                />
                {chatStatus === 'connected' ? (
                    <IconButton size='tiny' theme='red' title={t('disconnect')} onClick={() => LLMSocket.disconnect()}>
                        {t('disconnect')}
                    </IconButton>
                ) : (
                    <IconButton
                        filled
                        disabled={chatStatus === 'connecting'}
                        size='tiny'
                        theme='blue'
                        title={t('connect')}
                        onClick={() => LLMSocket.connect(wsUrl)}
                    >
                        {chatStatus === 'connecting' ? t('connecting') : t('connect')}
                    </IconButton>
                )}
                <IconButton
                    hideBorder
                    icon='x'
                    size='tiny'
                    theme='ghost'
                    title={t('close')}
                    onClick={() => setChatOpen(false)}
                />
            </header>

            {showSettings && (
                <div id='chat-settings'>
                    <label htmlFor='chat-ws-url'>{t('ws-url')}</label>
                    <input
                        id='chat-ws-url'
                        type='text'
                        spellCheck={false}
                        value={wsUrl}
                        onChange={(e) => {
                            setWsUrl(e.target.value);
                            StorageHandler.set('settings.chat.wsUrl', e.target.value.trim());
                        }}
                    />
                </div>
            )}

            <div id='chat-messages'>
                {chatMessages.length === 0 && (
                    <div id='chat-empty'>
                        <Icon name='chat' size={28} />
                        <p>{t('empty-title')}</p>
                        <p className='hint'>{t('empty-hint')}</p>
                    </div>
                )}

                {chatMessages.map((message) => (
                    <div key={message.id} className={`chat-message role-${message.role}`}>
                        {message.text && <p className='message-text'>{message.text}</p>}
                        {message.attachments && message.attachments.length > 0 && (
                            <div className='message-attachments'>
                                {message.attachments.map((attachment) => (
                                    <span key={`${attachment.kind}-${attachment.id}`} className='attachment-chip sent'>
                                        <Icon name={attachment.kind === 'playlist' ? 'playlist' : 'music'} size={11} />
                                        {attachment.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}

                <div ref={messageEndRef} />
            </div>

            <div id='chat-composer'>
                {chatAttachments.length > 0 && (
                    <div id='chat-attachments'>
                        {chatAttachments.map((attachment) => (
                            <span
                                key={`${attachment.kind}-${attachment.id}`}
                                className={`attachment-chip ${attachment.isLoading ? 'loading' : ''}`}
                            >
                                <Icon name={attachment.kind === 'playlist' ? 'playlist' : 'music'} size={11} />
                                <span className='attachment-name'>{attachment.name}</span>
                                {attachment.subtitle && (
                                    <span className='attachment-subtitle'>{attachment.subtitle}</span>
                                )}
                                <span
                                    className='attachment-remove'
                                    onClick={() =>
                                        setChatAttachments((current) =>
                                            current.filter(
                                                (existing) =>
                                                    !(
                                                        existing.kind === attachment.kind &&
                                                        existing.id === attachment.id
                                                    ),
                                            ),
                                        )
                                    }
                                >
                                    <Icon name='x' size={10} />
                                </span>
                            </span>
                        ))}
                    </div>
                )}

                <div id='chat-input-row'>
                    <textarea
                        id='chat-input'
                        rows={2}
                        placeholder={t('input-placeholder')}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <IconButton
                        filled
                        disabled={chatStatus !== 'connected'}
                        icon='send'
                        size='small'
                        theme='blue'
                        title={t('send')}
                        onClick={handleSend}
                    />
                </div>
            </div>
        </aside>
    );
};

export default ChatPanel;

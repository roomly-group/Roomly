import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, Mail, MessageCircle, MoreHorizontal, Send, X } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  customFetch,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  getGetListingQueryKey,
  getGetOwnerDashboardQueryKey,
  useListConversations,
  useSendMessage,
} from '@workspace/api-client-react';
import type { Conversation, Message } from '@workspace/api-client-react';
import { useAcceptConversation } from '@/hooks/use-accept-conversation';
import { useRejectConversation } from '@/hooks/use-reject-conversation';
import { useCancelConversation } from '@/hooks/use-cancel-conversation';
import { useReleaseListing } from '@/hooks/use-release-listing';
import { getOwnerListingsQueryKey } from '@/hooks/use-list-owner-listings';
import { normalizeMessages } from '@/lib/chat-messages';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

// How often the open chat / the inbox are re-fetched. React Query pauses this
// while the browser tab is in the background.
const MESSAGES_POLL_MS = 4000;
const CONVERSATIONS_POLL_MS = 10000;
// Quanti messaggi arrivano per richiesta (uguale a MESSAGES_PAGE nel backend).
const MESSAGES_PAGE = 100;

// Ordine unico e stabile: i messaggi confermati per id (l'ordine in cui il
// database li ha salvati), senza doppioni; quelli ancora "in volo" (id
// negativo) sempre in fondo, nell'ordine in cui sono stati inviati.
function sortMessages(list: Message[]): Message[] {
  const byId = new Map<number, Message>();
  for (const message of list) byId.set(message.id, message);
  const all = [...byId.values()];
  const confirmed = all.filter((m) => m.id > 0).sort((a, b) => a.id - b.id);
  const pending = all.filter((m) => m.id < 0).sort((a, b) => b.id - a.id);
  return [...confirmed, ...pending];
}

// Quanti degli ultimi messaggi confermati rileggere a ogni poll.
const POLL_OVERLAP = 5;

function TimeAgo({ value }: { value: string }) {
  const { t } = useLanguage();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{value}</>;

  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return <>{t('messages.justNow')}</>;
  if (hours < 24) return <>{t('messages.hoursAgo').replace('{h}', String(hours))}</>;
  if (hours < 48) return <>{t('messages.yesterday')}</>;
  return <>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>;
}

function MessageBubble({ message, viewerRole }: { message: Message; viewerRole: 'owner' | 'student' }) {
  const mine = message.sender === viewerRole;
  const isSystem = message.kind === 'system';
  if (isSystem) {
    return (
      <div className="flex justify-center items-center py-2" data-testid={`message-${message.id}`}>
        <p className="text-xs text-[#527067] italic">{message.body}</p>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`message-${message.id}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 ${
          mine ? 'rounded-br-md bg-[#0F6E56] text-[#E1F5EE]' : 'rounded-bl-md bg-[#E1F5EE] text-[#085041]'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-[10px] font-bold ${mine ? 'text-[#9FE1CB]' : 'text-[#527067]'}`}>
          <TimeAgo value={message.sentAt} />
        </p>
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  selectedId,
  owner = false,
}: {
  conversations: Conversation[];
  selectedId?: number;
  owner?: boolean;
}) {
  const { t } = useLanguage();

  const getStatusInfo = (status: Conversation['requestStatus']) => {
    let text = '';
    let colorBg = '';
    let colorText = '';
    switch (status) {
      case 'in_attesa':
        text = t('messages.status.in_attesa');
        colorBg = 'bg-[#FFF4E5]';
        colorText = 'text-[#B45309]';
        break;
      case 'accettata':
        text = t('messages.status.accettata');
        colorBg = 'bg-[#E1F5EE]';
        colorText = 'text-[#0F6E56]';
        break;
      case 'rifiutata':
        text = t('messages.status.rifiutata');
        colorBg = 'bg-[#FEE2E2]';
        colorText = 'text-[#a74b32]';
        break;
      case 'annullata':
        text = t('messages.status.annullata');
        colorBg = 'bg-[#E5E7EB]';
        colorText = 'text-[#527067]';
        break;
      default:
        text = status;
        colorBg = 'bg-[#E5E7EB]';
        colorText = 'text-[#527067]';
    }
    return { text, colorBg, colorText };
  };

  if (!conversations.length) {
    return (
      <EmptyState
        title={t('messages.inboxQuiet')}
        text={owner ? t('messages.emptyOwnerInbox') : t('messages.emptyStudentInbox')}
      />
    );
  }

  return (
    <div className="divide-y divide-[#e1ebe4]">
      {conversations.map((conversation) => {
        const { text: statusText, colorBg, colorText } = getStatusInfo(conversation.requestStatus);
        return (
          <Link
            href={`${owner ? '/owner/messages' : '/messages'}/${conversation.id}`}
            key={conversation.id}
            className={`flex gap-3 p-4 transition-colors hover:bg-[#E1F5EE]/65 ${
              selectedId === conversation.id ? 'bg-[#E1F5EE]' : ''
            }`}
            data-testid={`link-conversation-${conversation.id}`}
          >
            <Avatar name={conversation.participant} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="truncate text-sm font-black text-[#085041]">{conversation.participant}</h3>
                  <p className="truncate text-xs font-bold text-[#0F6E56]">{conversation.listingTitle}</p>
                  <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorBg} ${colorText}`}>
                    {statusText}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] font-bold text-[#82978e]">
                  <TimeAgo value={conversation.updatedAt} />
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className={`truncate text-sm ${conversation.unread ? 'font-extrabold text-[#2C2C2A]' : 'text-[#527067]'}`}>
                  {conversation.preview}
                </p>
                {conversation.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#EF9F27]" />}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ConversationPanel({
  conversationId,
  conversation,
  owner,
}: {
  conversationId: number;
  conversation?: Conversation;
  owner: boolean;
}) {
  const { t } = useLanguage();
  const client = useQueryClient();
  const messagesKey = getListMessagesQueryKey(conversationId);
  // Polling incrementale: dopo il primo caricamento chiede solo i messaggi con
  // id maggiore dell'ultimo già in cache (?after=) e li accoda. Gli id negativi
  // sono messaggi ottimistici non ancora confermati dal server.
  const { data, isLoading, isError, refetch } = useQuery<Message[]>({
    queryKey: messagesKey,
    refetchInterval: MESSAGES_POLL_MS,
    queryFn: async ({ signal }) => {
      const previous = client.getQueryData<Message[]>(messagesKey);
      const url = `/api/conversations/${conversationId}/messages`;
      if (!previous) return sortMessages(normalizeMessages(await customFetch<Message[]>(url, { signal })));

      // Con invii simultanei un messaggio con id più basso può diventare visibile
      // dopo uno più alto: se chiedessimo solo "id > ultimo" lo perderemmo per
      // sempre. Rileggiamo quindi gli ultimi POLL_OVERLAP messaggi (pochi record)
      // e deduplichiamo per id.
      const confirmedIds = previous
        .filter((m) => m.id > 0)
        .map((m) => m.id)
        .sort((a, b) => b - a);
      const after = confirmedIds.length >= POLL_OVERLAP ? confirmedIds[POLL_OVERLAP - 1] - 1 : 0;
      const fetched = normalizeMessages(await customFetch<Message[]>(`${url}?after=${after}`, { signal }));

      // Rileggo la cache DOPO la risposta: nel frattempo l'utente può aver
      // inviato un messaggio ottimistico che non va perso.
      const current = client.getQueryData<Message[]>(messagesKey) ?? previous;
      const known = new Set(current.map((m) => m.id));
      const fresh = fetched.filter((m) => !known.has(m.id));

      // Se tra i nuovi c'è la versione vera di un mio messaggio ancora "in volo",
      // tolgo quella provvisoria (altrimenti per un attimo comparirebbe due volte).
      const pending = current.filter((m) => m.id < 0);
      for (const real of fresh) {
        const index = pending.findIndex((p) => p.sender === real.sender && p.body === real.body);
        if (index !== -1) pending.splice(index, 1);
      }
      return sortMessages([...current.filter((m) => m.id > 0), ...fresh, ...pending]);
    },
  });
  const messages = data ?? [];
  const sendMessage = useSendMessage();
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverClosedChat, setServerClosedChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The same inbox lists chats where the person is the student AND chats where
  // they are the owner, so "mine" depends on the role in THIS conversation.
  const viewerRole: 'owner' | 'student' = conversation?.role ?? (owner ? 'owner' : 'student');

  const getStatusInfo = (status: Conversation['requestStatus']) => {
    let text = '';
    let colorBg = '';
    let colorText = '';
    switch (status) {
      case 'in_attesa':
        text = t('messages.status.in_attesa');
        colorBg = 'bg-[#FFF4E5]';
        colorText = 'text-[#B45309]';
        break;
      case 'accettata':
        text = t('messages.status.accettata');
        colorBg = 'bg-[#E1F5EE]';
        colorText = 'text-[#0F6E56]';
        break;
      case 'rifiutata':
        text = t('messages.status.rifiutata');
        colorBg = 'bg-[#FEE2E2]';
        colorText = 'text-[#a74b32]';
        break;
      case 'annullata':
        text = t('messages.status.annullata');
        colorBg = 'bg-[#E5E7EB]';
        colorText = 'text-[#527067]';
        break;
      default:
        text = status;
        colorBg = 'bg-[#E5E7EB]';
        colorText = 'text-[#527067]';
    }
    return { text, colorBg, colorText };
  };

  const statusInfo = conversation ? getStatusInfo(conversation.requestStatus) : { text: "", colorBg: "", colorText: "" };

  const acceptConversation = useAcceptConversation();
  const rejectConversation = useRejectConversation();
  const cancelConversation = useCancelConversation();
  const releaseListing = useReleaseListing();
  const { toast } = useToast();

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const { text: statusText, colorBg: statusColorBg, colorText: statusColorText } = statusInfo;
  const actionPending =
    acceptConversation.isPending ||
    rejectConversation.isPending ||
    cancelConversation.isPending ||
    releaseListing.isPending;

  const invalidateActionQueries = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getListConversationsQueryKey() }),
      client.invalidateQueries({ queryKey: getListMessagesQueryKey(conversationId) }),
      client.invalidateQueries({ queryKey: getGetListingQueryKey(conversation?.roomId ?? 0) }),
      client.invalidateQueries({ queryKey: getOwnerListingsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetOwnerDashboardQueryKey() }),
    ]);
  };

  const runConversationAction = async (action: () => Promise<unknown>) => {
    try {
      await action();
      await invalidateActionQueries();
    } catch {
      toast({
        title: t('messages.actionFailed'),
        description: t('messages.sendError'),
        variant: 'destructive',
      });
    }
  };

  const acceptRequest = () =>
    runConversationAction(() => acceptConversation.mutateAsync({ id: conversationId }));
  const rejectRequest = () =>
    runConversationAction(() => rejectConversation.mutateAsync({ id: conversationId }));
  const cancelRequest = () =>
    runConversationAction(() => cancelConversation.mutateAsync({ id: conversationId }));
  const releaseRoom = () =>
    runConversationAction(() => releaseListing.mutateAsync({ id: conversation?.roomId ?? 0 }));

  // Opening a chat marks it as read on the server: refresh the inbox so the
  // unread dot disappears (and again whenever new messages arrive).
  useEffect(() => {
    if (data) void client.invalidateQueries({ queryKey: getListConversationsQueryKey() });
  }, [client, conversationId, data?.length]);

  // Messaggi più vecchi: si caricano a blocchi di 100 quando si arriva in cima.
  const [canLoadOlder, setCanLoadOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const firstPageSeen = useRef(false);
  const stickToBottom = useRef(true);
  const restoreScroll = useRef<{ height: number; top: number } | null>(null);

  // Cambio chat: si riparte da zero.
  useEffect(() => {
    firstPageSeen.current = false;
    stickToBottom.current = true;
    setServerClosedChat(false);
    sendMessage.reset();
    setCanLoadOlder(false);
    setLoadingOlder(false);
  }, [conversationId]);

  // Prima pagina arrivata: se è piena (100) probabilmente ce ne sono altre sopra.
  useEffect(() => {
    if (data && !firstPageSeen.current) {
      firstPageSeen.current = true;
      setCanLoadOlder(data.filter((m) => m.id > 0).length >= MESSAGES_PAGE);
    }
  }, [data]);

  const loadOlder = useCallback(async () => {
    const current = client.getQueryData<Message[]>(messagesKey);
    const el = scrollRef.current;
    if (!current || !el || loadingOlder || !canLoadOlder) return;
    const oldest = current.reduce<number | null>((min, m) => (m.id > 0 && (min === null || m.id < min) ? m.id : min), null);
    if (oldest === null) return;

    setLoadingOlder(true);
    try {
      const older = normalizeMessages(await customFetch<Message[]>(
        `/api/conversations/${conversationId}/messages?before=${oldest}`,
      ));
      setCanLoadOlder(older.length >= MESSAGES_PAGE);
      if (older.length) {
        // Ricordo dov'ero: dopo il render riporto lo scroll sullo stesso messaggio.
        restoreScroll.current = { height: el.scrollHeight, top: el.scrollTop };
        client.setQueryData<Message[]>(messagesKey, (old) => {
          return sortMessages([...older, ...(old ?? [])]);
        });
      }
    } catch {
      // Errore di rete o rate limit: si riproverà alla prossima volta che si sale.
    } finally {
      setLoadingOlder(false);
    }
  }, [canLoadOlder, client, conversationId, loadingOlder, messagesKey]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (el.scrollTop < 80) void loadOlder();
  };

  // Dopo aver aggiunto messaggi in cima, mantiene la posizione di lettura.
  const firstId = messages[0]?.id;
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const saved = restoreScroll.current;
    if (el && saved) {
      el.scrollTop = el.scrollHeight - saved.height + saved.top;
      restoreScroll.current = null;
    }
  }, [firstId]);

  // Nuovo messaggio in fondo: scende solo se eri già in fondo o l'hai scritto tu
  // (altrimenti ti strapperebbe via mentre rileggi la cronologia).
  const lastMessage = messages[messages.length - 1];
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (stickToBottom.current || lastMessage?.sender === viewerRole) {
      el.scrollTop = el.scrollHeight;
    }
  }, [conversationId, lastMessage?.id, viewerRole]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const draft = body.trim();
    if (
      !draft ||
      !conversation ||
      conversation.requestStatus === 'rifiutata' ||
      conversation.requestStatus === 'annullata' ||
      serverClosedChat ||
      sendMessage.isPending
    ) return;

    // Optimistic UI: il messaggio compare subito, con id negativo temporaneo.
    const tempId = -Date.now();
    const optimistic: Message = {
      id: tempId,
      conversationId,
      body: draft,
      sender: viewerRole,
      sentAt: new Date().toISOString(),
      kind: 'user',
    };
    client.setQueryData<Message[]>(messagesKey, (old) => sortMessages([...(old ?? []), optimistic]));
    setBody('');

    // mutateAsync (e non mutate): con più invii ravvicinati le callback di
    // mutate() partirebbero solo per l'ultimo, lasciando i provvisori in lista.
    sendMessage
      .mutateAsync({ id: conversationId, data: { body: draft } })
      .then((message) => {
        const normalizedMessage = normalizeMessages([message])[0];
        // Il messaggio vero prende il posto del provvisorio e va nella posizione
        // data dal suo id (non in fondo): il polling potrebbe aver già portato
        // un messaggio dell'altro salvato dopo il mio.
        client.setQueryData<Message[]>(messagesKey, (old) =>
          sortMessages([...(old ?? []).filter((m) => m.id !== tempId), normalizedMessage]),
        );
        void client.invalidateQueries({ queryKey: getListConversationsQueryKey() });
      })
      .catch((error: unknown) => {
        // Invio fallito: tolgo il messaggio provvisorio e ridò il testo da riprovare.
        client.setQueryData<Message[]>(messagesKey, (old) => (old ?? []).filter((m) => m.id !== tempId));
        const isClosedResponse =
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 409 &&
          'data' in error &&
          typeof error.data === 'object' &&
          error.data !== null &&
          'error' in error.data &&
          error.data.error === 'Chat is closed';
        if (isClosedResponse) {
          setServerClosedChat(true);
        } else {
          setBody((current) => current || draft);
        }
      });
  };

  const requestStatus = conversation?.requestStatus;
  const isClosed = requestStatus === 'rifiutata' || requestStatus === 'annullata' || serverClosedChat;

  const copyListing = () => {
    if (conversation?.listingTitle) {
      void navigator.clipboard?.writeText(conversation.listingTitle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <>
      <div className="flex h-[75vh] max-h-[720px] min-h-[520px] flex-col">
        <div className="flex items-center justify-between border-b border-[#e1ebe4] p-5">
          <div className="flex items-center gap-3">
            <Link
              href={owner ? '/owner/messages' : '/messages'}
              className="-ml-2 rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE] lg:hidden"
              aria-label={t('messages.back')}
              data-testid="link-back-to-inbox"
            >
              <ChevronLeft size={20} />
            </Link>
            {conversation && <Avatar name={conversation.participant} size="sm" />}
            <div>
              <h2 className="font-black text-[#085041]">
                {conversation?.participant ?? t('messages.conversationFallback')}
              </h2>
              <p className="text-xs font-bold text-[#527067]">
                {conversation?.listingTitle ?? t('messages.roomlyMessagesFallback')}
              </p>
              <span className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColorBg} ${statusColorText}`}>
                {statusText}
              </span>
              {conversation?.roomStatus === 'affittata' && (
                <span className="ml-2 rounded-full bg-[#FCE8C8] px-2 py-0.5 text-xs font-bold text-[#8A4B08]">
                  {t('messages.roomRented')}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {conversation && (
              <>
                {conversation.requestStatus === 'in_attesa' && conversation.role === 'owner' && (
                  <>
                    <Button
                      variant="amber"
                      onClick={() => setShowAcceptDialog(true)}
                      disabled={actionPending}
                      aria-label={t('messages.accept')}
                      title={t('messages.accept')}
                      data-testid="button-accept-conversation"
                      className="h-11 rounded-full px-5"
                    >
                      <Check size={16} /> {t('messages.accept')}
                    </Button>
                    <Button
                      variant="amber"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionPending}
                      aria-label={t('messages.reject')}
                      title={t('messages.reject')}
                      data-testid="button-reject-conversation"
                      className="h-11 rounded-full px-5"
                    >
                      <X size={16} /> {t('messages.reject')}
                    </Button>
                  </>
                )}
                {conversation.requestStatus === 'in_attesa' && conversation.role === 'student' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={actionPending}
                    data-testid="button-cancel-conversation"
                  >
                    <X size={16} /> {t('messages.cancelRequest')}
                  </Button>
                )}
                {conversation.requestStatus === 'accettata' && conversation.role === 'owner' && (
                  <Button
                    variant="outline"
                    onClick={() => setShowReleaseDialog(true)}
                    disabled={actionPending}
                    data-testid="button-release-listing"
                  >
                    {t('messages.releaseRoom')}
                  </Button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center">
            <button
              onClick={copyListing}
              className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]"
              data-testid="button-conversation-more"
              aria-label={t('messages.copyListingName')}
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
        </div>

        {copied && (
          <p
            className="border-b border-[#e1ebe4] bg-[#E1F5EE] px-5 py-2 text-xs font-extrabold text-[#0F6E56]"
            data-testid="status-listing-copied"
          >
            {t('messages.listingNameCopied')}
          </p>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {loadingOlder && <div className="skeleton mx-auto h-4 w-24 rounded-full" />}
          {isLoading ? (
            <>
              {[1, 2, 3].map((item) => (
                <div key={item} className={`skeleton h-12 w-2/3 rounded-2xl ${item % 2 ? '' : 'ml-auto'}`} />
              ))}
            </>
          ) : isError ? (
            <QueryError onRetry={() => refetch()} />
          ) : messages.length ? (
            messages.map((message) => <MessageBubble key={message.id} message={message} viewerRole={viewerRole} />)
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-xl bg-[#E1F5EE] p-3 text-[#0F6E56]">
                <Mail size={22} />
              </div>
              <p className="mt-3 font-black text-[#085041]">{t('messages.startConversation')}</p>
              <p className="mt-1 text-sm text-[#527067]">{t('messages.startConversationText')}</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-[#e1ebe4] p-4">
          <div className="flex items-end gap-2 rounded-xl border border-[#c8ddd2] bg-[#F1EFE8] p-2 focus-within:border-[#0F6E56]">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter inserts a new line.
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={2000}
              rows={1}
              placeholder={isClosed ? t('messages.closedChat') : t('messages.writeMessage')}
              disabled={isClosed || sendMessage.isPending}
              className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#82978e]"
              data-testid="input-message-body"
            />
            <Button
              type="submit"
              className="h-10 w-10 shrink-0 rounded-lg p-0"
              disabled={!body.trim() || isClosed || sendMessage.isPending}
              data-testid="button-send-message"
            >
              <Send size={16} />
            </Button>
          </div>
          {sendMessage.isError && (
            <p className="mt-2 text-xs font-bold text-[#a74b32]">
              {isClosed ? t('messages.closedChat') : t('messages.sendError')}
            </p>
          )}
        </form>
      </div>
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent className="w-[300px] sm:w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.acceptConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.acceptConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.tryAgain')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void acceptRequest()}
              disabled={actionPending}
            >
              {t('messages.accept')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent className="w-[300px] sm:w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.rejectConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.rejectConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.tryAgain')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void rejectRequest()}
              disabled={actionPending}
            >
              {t('messages.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent className="w-[300px] sm:w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.cancelConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.cancelConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.tryAgain')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void cancelRequest()}
              disabled={actionPending}
            >
              {t('messages.cancelRequest')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showReleaseDialog} onOpenChange={setShowReleaseDialog}>
        <AlertDialogContent className="w-[300px] sm:w-[350px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.releaseListing')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.releaseListingDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.tryAgain')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void releaseRoom()}
              disabled={actionPending}
            >
              {t('messages.releaseRoom')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function MessagesPage({ owner = false }: { owner?: boolean }) {
  const { t } = useLanguage();
  const { id } = useParams<{ id?: string }>();
  const { data, isLoading, isError, refetch } = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: CONVERSATIONS_POLL_MS },
  });
  // One synchronized inbox: /messages and /owner/messages show the same chats
  // (as student and as owner), so nothing is split between the two sections.
  const conversations = data ?? [];
  // No conversation is auto-opened: the right panel starts on the
  // "select a contact" placeholder until the person picks one from the inbox.
  const selectedId = id ? Number(id) : undefined;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px] px-5 py-8 lg:px-8 lg:py-12">
        <PageIntro
          eyebrow={owner ? t('messages.ownerInboxEyebrow') : t('messages.yourMessagesEyebrow')}
          title={owner ? t('messages.ownerTitle') : t('messages.studentTitle')}
          description={owner ? t('messages.ownerDescription') : t('messages.studentDescription')}
        />

        <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-[#d6e7de] bg-[#F8F8F2] lg:grid-cols-[360px_1fr]">
          <section
            className={`border-b border-[#d6e7de] lg:block lg:border-b-0 lg:border-r ${selectedId ? 'hidden' : ''}`}
          >
            <div className="flex items-center justify-between border-b border-[#e1ebe4] p-4">
              <h2 className="font-black text-[#085041]">{t('messages.inbox')}</h2>
              <span className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-black text-[#0F6E56]">
                {conversations.length}
              </span>
            </div>

            {isLoading ? (
              <div className="space-y-4 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-1/2 rounded" />
                      <div className="skeleton h-3 w-4/5 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="p-4">
                <QueryError onRetry={() => refetch()} />
              </div>
            ) : (
              <ConversationList conversations={conversations} selectedId={selectedId} owner={owner} />
            )}
          </section>

          <section className={selectedId ? 'block' : 'hidden lg:block'}>
            {selectedId ? (
              <ConversationPanel
                conversationId={selectedId}
                conversation={conversations.find((item) => item.id === selectedId)}
                owner={owner}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                <MessageCircle size={30} className="mb-3 text-[#9FE1CB]" />
                <p className="font-black text-[#085041]">{t('messages.pickConversation')}</p>
                <p className="mt-1 text-sm text-[#527067]">{t('messages.pickConversationText')}</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

export function StudentMessagesRoute() {
  return <MessagesPage />;
}

export function OwnerMessagesRoute() {
  return <MessagesPage owner />;
}

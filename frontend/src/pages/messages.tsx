import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, Copy, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
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
import { useDeleteConversation } from '@/hooks/use-delete-conversation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useReleaseListing } from '@/hooks/use-release-listing';
import { getOwnerListingsQueryKey } from '@/hooks/use-list-owner-listings';
import { normalizeMessages } from '@/lib/chat-messages';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { RequestStatus } from '@/components/shared/request-status';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { APP_ROUTES } from '@/lib/constants';
import { MESSAGE_MAX_LENGTH_CHARS, MESSAGES_PAGE_SIZE, API_BASE_PATH, API_ROUTE_PATHS } from '@workspace/api-zod';

// ===================== CONFIGURATION =====================

// How often the open chat / the inbox are re-fetched. React Query pauses this
// while the browser tab is in the background.
/** Poll interval for the active conversation messages (ms). */
const MESSAGES_POLL_MS = 4000 as const;
/** Poll interval for inbox conversation updates (ms). */
const CONVERSATIONS_POLL_MS = 10000 as const;
/** Number of recent confirmed messages reread during polling (messages). */
const POLL_OVERLAP = 5 as const;
/** Duration before copied-listing feedback is hidden (ms). */
const COPY_FEEDBACK_RESET_MS = 1800 as const;
/** Number of milliseconds in one hour, used for relative message timestamps (ms/hour). */
const HOUR_MS = 3600000 as const;
/** Threshold below which timestamps display the just-now label (hours). */
const JUST_NOW_THRESHOLD_HOURS = 1 as const;
/** Threshold below which timestamps display an hours-ago label (hours). */
const HOURS_AGO_THRESHOLD_HOURS = 24 as const;
/** Threshold below which timestamps display the yesterday label (hours). */
const YESTERDAY_THRESHOLD_HOURS = 48 as const;
/** Scroll distance from the bottom that keeps the view pinned to the latest message (px). */
const CHAT_SCROLL_BOTTOM_THRESHOLD_PX = 120 as const;
/** Scroll position that triggers loading older messages (px). */
const CHAT_SCROLL_TOP_THRESHOLD_PX = 80 as const;
/** Confirm-button colours for the destructive dialogs (reject, delete). */
const DESTRUCTIVE_ACTION_CLASS = 'bg-terracotta text-paper hover:bg-terracotta/90' as const;
/** Stable selectors used by conversation and message controls. */
const MESSAGE_TEST_IDS = {
  MESSAGE_ROW_PREFIX: 'message-',
  CONVERSATION_LINK_PREFIX: 'link-conversation-',
  LINK_BACK_TO_INBOX: 'link-back-to-inbox',
  BUTTON_ACCEPT_CONVERSATION: 'button-accept-conversation',
  BUTTON_REJECT_CONVERSATION: 'button-reject-conversation',
  BUTTON_CANCEL_CONVERSATION: 'button-cancel-conversation',
  BUTTON_RELEASE_LISTING: 'button-release-listing',
  BUTTON_CONVERSATION_MORE: 'button-conversation-more',
  MENU_COPY_LISTING: 'menu-copy-listing',
  MENU_DELETE_CONVERSATION: 'menu-delete-conversation',
  STATUS_LISTING_COPIED: 'status-listing-copied',
  INPUT_MESSAGE_BODY: 'input-message-body',
  BUTTON_SEND_MESSAGE: 'button-send-message',
  BUTTON_CONFIRM_DELETE_CONVERSATION: 'button-confirm-delete-conversation',
} as const;

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
function TimeAgo({ value }: { value: string }) {
  const { t, language } = useLanguage();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{value}</>;

  const hours = Math.floor((Date.now() - date.getTime()) / HOUR_MS);
  if (hours < JUST_NOW_THRESHOLD_HOURS) return <>{t('messages.justNow')}</>;
  if (hours < HOURS_AGO_THRESHOLD_HOURS) return <>{t('messages.hoursAgo').replace('{h}', String(hours))}</>;
  if (hours < YESTERDAY_THRESHOLD_HOURS) return <>{t('messages.yesterday')}</>;
  return <>{date.toLocaleDateString(language, { day: 'numeric', month: 'short' })}</>;
}

function MessageBubble({ message, viewerRole }: { message: Message; viewerRole: 'owner' | 'student' }) {
  const mine = message.sender === viewerRole;
  const isSystem = message.kind === 'system';
  if (isSystem) {
    // System notes sit on the timeline like a ruled entry, not like a speaker.
    return (
      <div
        className="flex items-center gap-3 py-2 text-center text-[13px] font-bold text-sage before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line"
        data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}
      >
        <p className="max-w-[70%]">{message.body}</p>
      </div>
    );
  }
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}>
      <div
        className={`max-w-[78%] rounded-control px-3.5 py-2.5 text-[15px] leading-6 ${
          mine ? 'rounded-br-[2px] bg-shutter text-mint-mist' : 'rounded-bl-[2px] bg-mint-mist text-pine'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-0.5 text-[11px] font-bold tabular-nums ${mine ? 'text-mint-mist/90' : 'text-sage'}`}>
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

  if (!conversations.length) {
    return (
      <EmptyState
        title={t('messages.inboxQuiet')}
        text={owner ? t('messages.emptyOwnerInbox') : t('messages.emptyStudentInbox')}
      />
    );
  }

  return (
    <ul>
      {conversations.map((conversation) => {
        const selected = selectedId === conversation.id;
        return (
          <li key={conversation.id} className="border-b border-line last:border-b-0">
            <Link
              href={`${owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}/${conversation.id}`}
              aria-current={selected ? 'page' : undefined}
              className={`flex gap-3 px-4 py-4 transition-colors hover:bg-mint-mist/60 ${
                selected ? 'bg-mint-mist' : ''
              }`}
              data-testid={`${MESSAGE_TEST_IDS.CONVERSATION_LINK_PREFIX}${conversation.id}`}
            >
              <Avatar name={conversation.participant} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate text-[15px] font-extrabold text-pine">{conversation.participant}</h3>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-sage">
                    <TimeAgo value={conversation.updatedAt} />
                  </span>
                </div>
                <p className="truncate text-[13px] font-bold text-shutter">{conversation.listingTitle}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className={`min-w-0 flex-1 truncate text-sm ${conversation.unread ? 'font-extrabold text-ink' : 'text-sage'}`}>
                    {conversation.preview}
                  </p>
                  {conversation.unread && (
                    <span className="h-2 w-2 shrink-0 bg-shutter" role="img" aria-label={t('messages.unread')} />
                  )}
                </div>
                <RequestStatus status={conversation.requestStatus} className="mt-2" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
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
      const url = `${API_BASE_PATH}${API_ROUTE_PATHS.CONVERSATION_MESSAGES.replace(':id', String(conversationId))}`;
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

  const acceptConversation = useAcceptConversation();
  const rejectConversation = useRejectConversation();
  const cancelConversation = useCancelConversation();
  const deleteConversation = useDeleteConversation();
  const [, setLocation] = useLocation();
  const releaseListing = useReleaseListing();
  const { toast } = useToast();

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const actionPending =
    acceptConversation.isPending ||
    rejectConversation.isPending ||
    cancelConversation.isPending ||
    deleteConversation.isPending ||
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
  const deleteChat = async () => {
    try {
      await deleteConversation.mutateAsync({ id: conversationId });
      setShowDeleteDialog(false);
      setLocation(conversation?.role === 'owner' ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES);
      await client.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      setShowDeleteDialog(false);
    }
  };
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
      setCanLoadOlder(data.filter((m) => m.id > 0).length >= MESSAGES_PAGE_SIZE);
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
        `${API_BASE_PATH}${API_ROUTE_PATHS.CONVERSATION_MESSAGES.replace(':id', String(conversationId))}?before=${oldest}`,
      ));
      setCanLoadOlder(older.length >= MESSAGES_PAGE_SIZE);
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
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < CHAT_SCROLL_BOTTOM_THRESHOLD_PX;
    if (el.scrollTop < CHAT_SCROLL_TOP_THRESHOLD_PX) void loadOlder();
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
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_RESET_MS);
    }
  };

  return (
    <>
      <div className="flex h-[calc(100dvh-176px)] min-h-[400px] flex-col lg:h-[75vh] lg:max-h-[720px] lg:min-h-[520px]">
        <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
          <Link
            href={owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-pine hover:bg-mint-mist lg:hidden"
            aria-label={t('messages.back')}
            data-testid={MESSAGE_TEST_IDS.LINK_BACK_TO_INBOX}
          >
            <ChevronLeft size={20} />
          </Link>
          {conversation && <Avatar name={conversation.participant} size="sm" />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-black text-pine">
              {conversation?.participant ?? t('messages.conversationFallback')}
            </h2>
            <p className="truncate text-[13px] font-bold text-shutter">
              {conversation?.listingTitle ?? t('messages.roomlyMessagesFallback')}
            </p>
            {conversation && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <RequestStatus status={conversation.requestStatus} />
                {conversation.roomStatus === 'affittata' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-pine">
                    <span className="h-2 w-2 bg-pine" aria-hidden />
                    {t('messages.roomRented')}
                  </span>
                )}
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid h-11 w-11 shrink-0 place-items-center rounded-control text-pine hover:bg-mint-mist"
                data-testid={MESSAGE_TEST_IDS.BUTTON_CONVERSATION_MORE}
                aria-label={t('messages.moreOptions')}
              >
                <MoreHorizontal size={19} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={copyListing} data-testid={MESSAGE_TEST_IDS.MENU_COPY_LISTING}>
                <Copy size={15} className="mr-2" /> {t('messages.copyListingName')}
              </DropdownMenuItem>
              {requestStatus === 'annullata' && (
                <DropdownMenuItem
                  onSelect={() => setShowDeleteDialog(true)}
                  className="text-terracotta"
                  data-testid={MESSAGE_TEST_IDS.MENU_DELETE_CONVERSATION}
                >
                  <Trash2 size={15} className="mr-2" /> {t('messages.deleteChat')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {conversation &&
          (conversation.requestStatus === 'in_attesa' ||
            (conversation.requestStatus === 'accettata' && conversation.role === 'owner')) && (
            <div className="flex flex-wrap items-center gap-2 border-b border-line bg-ground/60 px-3 py-3 sm:px-5">
              {conversation.requestStatus === 'in_attesa' && conversation.role === 'owner' && (
                <>
                  <Button
                    variant="amber"
                    onClick={() => setShowAcceptDialog(true)}
                    disabled={actionPending}
                    data-testid={MESSAGE_TEST_IDS.BUTTON_ACCEPT_CONVERSATION}
                  >
                    {t('messages.accept')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionPending}
                    data-testid={MESSAGE_TEST_IDS.BUTTON_REJECT_CONVERSATION}
                  >
                    {t('messages.reject')}
                  </Button>
                </>
              )}
              {conversation.requestStatus === 'in_attesa' && conversation.role === 'student' && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={actionPending}
                  data-testid={MESSAGE_TEST_IDS.BUTTON_CANCEL_CONVERSATION}
                >
                  {t('messages.cancelRequest')}
                </Button>
              )}
              {conversation.requestStatus === 'accettata' && conversation.role === 'owner' && (
                <Button
                  variant="outline"
                  onClick={() => setShowReleaseDialog(true)}
                  disabled={actionPending}
                  data-testid={MESSAGE_TEST_IDS.BUTTON_RELEASE_LISTING}
                >
                  {t('messages.releaseRoom')}
                </Button>
              )}
            </div>
          )}

        {copied && (
          <p
            className="border-b border-line bg-mint-mist px-5 py-2 text-[13px] font-extrabold text-shutter"
            role="status"
            data-testid={MESSAGE_TEST_IDS.STATUS_LISTING_COPIED}
          >
            {t('messages.listingNameCopied')}
          </p>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-5 sm:px-5">
          {loadingOlder && <div className="skeleton mx-auto h-4 w-24 rounded-sheet" />}
          {isLoading ? (
            <>
              {[1, 2, 3].map((item) => (
                <div key={item} className={`skeleton h-12 w-2/3 rounded-control ${item % 2 ? '' : 'ml-auto'}`} />
              ))}
            </>
          ) : isError ? (
            <QueryError inset onRetry={() => refetch()} />
          ) : messages.length ? (
            messages.map((message) => <MessageBubble key={message.id} message={message} viewerRole={viewerRole} />)
          ) : (
            <div className="flex h-full flex-col justify-end pb-4">
              <p className="text-[17px] font-black text-pine">{t('messages.startConversation')}</p>
              <p className="mt-1 max-w-sm text-sm leading-6 text-sage">{t('messages.startConversationText')}</p>
            </div>
          )}
        </div>

        <form onSubmit={submit} className="border-t border-line p-3 sm:p-4">
          <div className="flex items-end gap-2 rounded-control border border-field bg-paper p-1.5 focus-within:border-shutter focus-within:ring-[3px] focus-within:ring-mint-wash/40">
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
              maxLength={MESSAGE_MAX_LENGTH_CHARS}
              rows={1}
              aria-label={t('messages.writeMessage')}
              placeholder={isClosed ? t('messages.closedChat') : t('messages.writeMessage')}
              disabled={isClosed || sendMessage.isPending}
              className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-base text-ink outline-none placeholder:text-sage disabled:cursor-not-allowed"
              data-testid={MESSAGE_TEST_IDS.INPUT_MESSAGE_BODY}
            />
            <Button
              type="submit"
              aria-label={t('messages.send')}
              title={t('messages.send')}
              className="h-11 w-11 shrink-0 p-0"
              disabled={!body.trim() || isClosed || sendMessage.isPending}
              data-testid={MESSAGE_TEST_IDS.BUTTON_SEND_MESSAGE}
            >
              <Send size={17} />
            </Button>
          </div>
          {sendMessage.isError && (
            <p className="mt-2 text-[13px] font-bold text-terracotta" role="alert">
              {isClosed ? t('messages.closedChat') : t('messages.sendError')}
            </p>
          )}
        </form>
      </div>
      <AlertDialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.acceptConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.acceptConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.rejectConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.rejectConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void rejectRequest()}
              disabled={actionPending}
              className={DESTRUCTIVE_ACTION_CLASS}
            >
              {t('messages.reject')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.deleteChat')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.deleteChatDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('messages.keepChat')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void deleteChat()}
              className={DESTRUCTIVE_ACTION_CLASS}
              data-testid={MESSAGE_TEST_IDS.BUTTON_CONFIRM_DELETE_CONVERSATION}
            >
              {t('messages.deleteChat')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.cancelConversation')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.cancelConversationDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.releaseListing')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.releaseListingDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
      <div className={`mx-auto max-w-[1320px] px-5 lg:px-8 lg:py-12 ${selectedId ? 'pb-4 pt-3' : 'py-8'}`}>
        {/* With a chat open on a phone the chat owns the screen; the title stays for screen readers. */}
        <PageIntro title={t('nav.messages')} className={selectedId ? 'max-lg:sr-only' : undefined} />

        <div className="grid overflow-hidden lg:min-h-[520px] rounded-sheet border border-hairline bg-paper lg:grid-cols-[360px_1fr]">
          <section
            aria-labelledby="inbox-title"
            className={`border-b border-line lg:block lg:border-b-0 lg:border-r ${selectedId ? 'hidden' : ''}`}
          >
            <div className="flex items-baseline justify-between border-b border-line px-4 py-4">
              <h2 id="inbox-title" className="text-[17px] font-black text-pine">{t('messages.inbox')}</h2>
              <span className="text-sm font-bold tabular-nums text-sage">{conversations.length}</span>
            </div>

            {isLoading ? (
              <div className="space-y-5 p-4">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="flex gap-3">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-1/2 rounded-sheet" />
                      <div className="skeleton h-3 w-4/5 rounded-sheet" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isError ? (
              <div className="p-4">
                <QueryError inset onRetry={() => refetch()} />
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
              <div className="flex h-full flex-col justify-center px-10 py-12">
                <p className="text-[22px] font-black leading-tight text-pine">{t('messages.pickConversation')}</p>
                <p className="mt-2 max-w-sm text-[15px] leading-6 text-sage">{t('messages.pickConversationText')}</p>
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

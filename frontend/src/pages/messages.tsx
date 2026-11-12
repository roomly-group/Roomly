import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Ban, Check, ChevronDown, ChevronLeft, Copy, Flag, Mail, MessageCircle, MoreHorizontal, Send, ShieldAlert, Trash2, X } from 'lucide-react';
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
import { isDeletedMessage, normalizeMessages, participantName } from '@/lib/chat-messages';
import { useLanguage } from '@/lib/i18n';
import { AppShell, Avatar } from '@/components/layout/app-shell';
import { Button } from '@/components/shared/button';
import { PageIntro } from '@/components/shared/page-intro';
import { QueryError } from '@/components/shared/query-error';
import { EmptyState } from '@/components/shared/empty-state';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { APP_ROUTES } from '@/lib/constants';
import { MESSAGE_MAX_LENGTH_CHARS, MESSAGES_PAGE_SIZE, API_BASE_PATH, API_ROUTE_PATHS, SAFETY_ERROR_CODES } from '@workspace/api-zod';
import { apiErrorCode } from '@/lib/api-error';
import { hideSafetyTip, isSafetyTipHidden, looksLikeScamRisk } from '@/lib/scam-patterns';
import { useSetBlocked } from '@/hooks/use-safety';
import { ReportDialog, type ReportSubject } from '@/components/shared/report-dialog';

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
  // Safety tools (RMY-12).
  MENU_REPORT_USER: 'menu-report-user',
  MENU_BLOCK_USER: 'menu-block-user',
  BUTTON_CONFIRM_BLOCK: 'button-confirm-block',
  BUTTON_UNBLOCK: 'button-unblock-user',
  BUTTON_REPORT_MESSAGE_PREFIX: 'button-report-message-',
  WARNING_MESSAGE_PREFIX: 'warning-message-',
  SAFETY_TIP: 'safety-tip',
  BUTTON_HIDE_SAFETY_TIP: 'button-hide-safety-tip',
  BUTTON_TOGGLE_BLOCKED: 'button-toggle-blocked-chats',
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
  const { t } = useLanguage();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{value}</>;

  const hours = Math.floor((Date.now() - date.getTime()) / HOUR_MS);
  if (hours < JUST_NOW_THRESHOLD_HOURS) return <>{t('messages.justNow')}</>;
  if (hours < HOURS_AGO_THRESHOLD_HOURS) return <>{t('messages.hoursAgo').replace('{h}', String(hours))}</>;
  if (hours < YESTERDAY_THRESHOLD_HOURS) return <>{t('messages.yesterday')}</>;
  return <>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>;
}

function MessageBubble({
  message,
  viewerRole,
  onReport,
}: {
  message: Message;
  viewerRole: 'owner' | 'student';
  /** Opens the report dialog for this message; only given for the other person's texts. */
  onReport?: (messageId: number) => void;
}) {
  const { t } = useLanguage();
  const mine = message.sender === viewerRole;
  // Its author deleted their account: the text is gone, only a placeholder is shown.
  const deleted = isDeletedMessage(message);
  const isSystem = message.kind === 'system';
  if (isSystem) {
    return (
      <div className="flex justify-center items-center py-2" data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}>
        <p className="text-xs text-[#527067] italic">{message.body}</p>
      </div>
    );
  }
  // RMY-12: the other person's text with an IBAN, phone, messaging app or link gets a scam warning.
  const incoming = !mine && !deleted && message.id > 0;
  const flagged = incoming && looksLikeScamRisk(message.body);
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}>
      <div className="max-w-[75%]">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
            mine ? 'rounded-br-md bg-[#0F6E56] text-[#E1F5EE]' : 'rounded-bl-md bg-[#E1F5EE] text-[#085041]'
          }`}
        >
          <p className={`whitespace-pre-wrap break-words ${deleted ? 'italic opacity-80' : ''}`}>
            {deleted ? t('messages.deletedMessage') : message.body}
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className={`text-[10px] font-bold ${mine ? 'text-[#9FE1CB]' : 'text-[#527067]'}`}>
              <TimeAgo value={message.sentAt} />
            </p>
            {incoming && onReport ? (
              <button
                type="button"
                onClick={() => onReport(message.id)}
                aria-label={t('safety.reportMessage')}
                title={t('safety.reportMessage')}
                className="-my-1 -mr-2 grid h-7 w-7 place-items-center rounded-full text-sage transition-colors hover:bg-paper hover:text-terracotta"
                data-testid={`${MESSAGE_TEST_IDS.BUTTON_REPORT_MESSAGE_PREFIX}${message.id}`}
              >
                <Flag size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {flagged ? (
          <p
            className="mt-1.5 flex items-start gap-2 rounded-xl bg-sun/20 px-3 py-2 text-xs font-bold leading-5 text-amber-ink"
            role="note"
            data-testid={`${MESSAGE_TEST_IDS.WARNING_MESSAGE_PREFIX}${message.id}`}
          >
            <ShieldAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            {t('safety.flaggedMessage')}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ConversationList({
  conversations,
  blocked = [],
  selectedId,
  owner = false,
}: {
  conversations: Conversation[];
  /** Chats with people the viewer blocked (RMY-12): kept out of the list, behind a "Blocked" toggle. */
  blocked?: Conversation[];
  selectedId?: number;
  owner?: boolean;
}) {
  const { t } = useLanguage();
  // Opened by default when the chat on screen is one of the blocked ones.
  const [showBlocked, setShowBlocked] = useState(() => blocked.some((item) => item.id === selectedId));

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

  const renderRow = (conversation: Conversation) => {
        const { text: statusText, colorBg, colorText } = getStatusInfo(conversation.requestStatus);
        return (
          <Link
            href={`${owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}/${conversation.id}`}
            key={conversation.id}
            className={`flex gap-3 p-4 transition-colors hover:bg-[#E1F5EE]/65 ${
              selectedId === conversation.id ? 'bg-[#E1F5EE]' : ''
            } ${conversation.blockedByMe ? 'opacity-70' : ''}`}
            data-testid={`${MESSAGE_TEST_IDS.CONVERSATION_LINK_PREFIX}${conversation.id}`}
          >
            <Avatar name={participantName(conversation, t('messages.deletedUser'))} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="truncate text-sm font-black text-[#085041]">{participantName(conversation, t('messages.deletedUser'))}</h3>
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
  };

  return (
    <>
      {conversations.length ? (
        <div className="divide-y divide-[#e1ebe4]">{conversations.map(renderRow)}</div>
      ) : (
        <EmptyState
          title={t('messages.inboxQuiet')}
          text={owner ? t('messages.emptyOwnerInbox') : t('messages.emptyStudentInbox')}
        />
      )}
      {blocked.length ? (
        <div className="border-t border-[#e1ebe4]">
          <button
            type="button"
            onClick={() => setShowBlocked((current) => !current)}
            aria-expanded={showBlocked}
            className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-sm font-extrabold text-[#527067] transition-colors hover:bg-[#E1F5EE]/65"
            data-testid={MESSAGE_TEST_IDS.BUTTON_TOGGLE_BLOCKED}
          >
            <span className="flex items-center gap-2">
              <Ban size={15} aria-hidden />
              {t('safety.blockedSection').replace('{n}', String(blocked.length))}
            </span>
            <ChevronDown size={16} className={`transition-transform ${showBlocked ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {showBlocked ? <div className="divide-y divide-[#e1ebe4] border-t border-[#e1ebe4]">{blocked.map(renderRow)}</div> : null}
        </div>
      ) : null}
    </>
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
  const deleteConversation = useDeleteConversation();
  const [, setLocation] = useLocation();
  const releaseListing = useReleaseListing();
  const { toast } = useToast();

  // ---------- Safety tools (RMY-12) ----------
  const setBlocked = useSetBlocked();
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  // What the report dialog is about (the person, or one of their messages); null = closed.
  const [report, setReport] = useState<{ subject: ReportSubject; title: string } | null>(null);
  const [tipHidden, setTipHidden] = useState(() => isSafetyTipHidden(conversationId));
  const otherName = conversation ? participantName(conversation, t('messages.deletedUser')) : '';
  // Nothing to report or block once the other person deleted their account.
  const canModerate = Boolean(conversation && !conversation.participantDeleted);

  const reportPerson = () =>
    setReport({
      subject: { target: 'user', conversationId },
      title: t('safety.reportUser').replace('{name}', otherName),
    });
  const reportMessage = (messageId: number) =>
    setReport({ subject: { target: 'message', messageId }, title: t('safety.reportTitleMessage') });

  const changeBlock = async (blocked: boolean) => {
    try {
      await setBlocked.mutateAsync({ conversationId, blocked });
      setShowBlockDialog(false);
      toast({ title: t(blocked ? 'safety.blockDone' : 'safety.unblockDone').replace('{name}', otherName) });
      // A blocked chat leaves the inbox: go back to the list.
      if (blocked) setLocation(owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES);
    } catch {
      toast({ title: t('safety.actionError'), variant: 'destructive' });
    }
  };

  const dismissTip = () => {
    hideSafetyTip(conversationId);
    setTipHidden(true);
  };

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReleaseDialog, setShowReleaseDialog] = useState(false);
  const { text: statusText, colorBg: statusColorBg, colorText: statusColorText } = statusInfo;
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
    } catch (error) {
      const code = apiErrorCode(error);
      toast({
        title: t('messages.actionFailed'),
        description:
          code === 'has_signed_contract'
            ? t('dashboard.releaseHasContract')
            : code === 'not_accepted'
              ? t('dashboard.releaseNotAccepted')
              : code === SAFETY_ERROR_CODES.BLOCKED
                ? t('safety.blockedChat')
                : t('messages.sendError'),
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
    setTipHidden(isSafetyTipHidden(conversationId));
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
      conversation.messagingBlocked ||
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
        // RMY-12: the other person blocked the viewer meanwhile: the chat closes the same way.
        const isBlockedResponse = apiErrorCode(error) === SAFETY_ERROR_CODES.BLOCKED;
        if (isClosedResponse || isBlockedResponse) {
          setServerClosedChat(true);
          if (isBlockedResponse) void client.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        } else {
          setBody((current) => current || draft);
        }
      });
  };

  const requestStatus = conversation?.requestStatus;
  const isBlocked = Boolean(conversation?.messagingBlocked);
  const isClosed = requestStatus === 'rifiutata' || requestStatus === 'annullata' || serverClosedChat || isBlocked;
  // Placeholder of the disabled composer: a block explains itself, otherwise the request is closed.
  const closedLabel = isBlocked ? t('safety.blockedChat') : t('messages.closedChat');

  const copyListing = () => {
    if (conversation?.listingTitle) {
      void navigator.clipboard?.writeText(conversation.listingTitle);
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_RESET_MS);
    }
  };

  return (
    <>
      <div className="flex h-[75vh] max-h-[720px] min-h-[520px] flex-col">
        <div className="flex items-center justify-between border-b border-[#e1ebe4] p-5">
          <div className="flex items-center gap-3">
            <Link
              href={owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}
              className="-ml-2 rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE] lg:hidden"
              aria-label={t('messages.back')}
              data-testid={MESSAGE_TEST_IDS.LINK_BACK_TO_INBOX}
            >
              <ChevronLeft size={20} />
            </Link>
            {conversation && <Avatar name={participantName(conversation, t('messages.deletedUser'))} size="sm" />}
            <div>
              <h2 className="font-black text-[#085041]">
                {conversation ? participantName(conversation, t('messages.deletedUser')) : t('messages.conversationFallback')}
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
                    {/* A blocked person cannot be accepted (the backend refuses it too). */}
                    {!isBlocked && <Button
                      variant="amber"
                      onClick={() => setShowAcceptDialog(true)}
                      disabled={actionPending}
                      aria-label={t('messages.accept')}
                      title={t('messages.accept')}
                      data-testid={MESSAGE_TEST_IDS.BUTTON_ACCEPT_CONVERSATION}
                      className="h-11 rounded-full px-5"
                    >
                      <Check size={16} /> {t('messages.accept')}
                    </Button>}
                    <Button
                      variant="amber"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={actionPending}
                      aria-label={t('messages.reject')}
                      title={t('messages.reject')}
                      data-testid={MESSAGE_TEST_IDS.BUTTON_REJECT_CONVERSATION}
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
                    data-testid={MESSAGE_TEST_IDS.BUTTON_CANCEL_CONVERSATION}
                  >
                    <X size={16} /> {t('messages.cancelRequest')}
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
              </>
            )}
          </div>
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-lg p-2 text-[#527067] hover:bg-[#E1F5EE]"
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
                    className="text-[#a74b32]"
                    data-testid={MESSAGE_TEST_IDS.MENU_DELETE_CONVERSATION}
                  >
                    <Trash2 size={15} className="mr-2" /> {t('messages.deleteChat')}
                  </DropdownMenuItem>
                )}
                {canModerate && (
                  <>
                    <DropdownMenuItem onSelect={reportPerson} className="text-[#a74b32]" data-testid={MESSAGE_TEST_IDS.MENU_REPORT_USER}>
                      <Flag size={15} className="mr-2" /> {t('safety.reportUser').replace('{name}', otherName)}
                    </DropdownMenuItem>
                    {conversation?.blockedByMe ? (
                      <DropdownMenuItem onSelect={() => void changeBlock(false)} data-testid={MESSAGE_TEST_IDS.MENU_BLOCK_USER}>
                        <Ban size={15} className="mr-2" /> {t('safety.unblock')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() => setShowBlockDialog(true)}
                        className="text-[#a74b32]"
                        data-testid={MESSAGE_TEST_IDS.MENU_BLOCK_USER}
                      >
                        <Ban size={15} className="mr-2" /> {t('safety.block').replace('{name}', otherName)}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {copied && (
          <p
            className="border-b border-[#e1ebe4] bg-[#E1F5EE] px-5 py-2 text-xs font-extrabold text-[#0F6E56]"
            data-testid={MESSAGE_TEST_IDS.STATUS_LISTING_COPIED}
          >
            {t('messages.listingNameCopied')}
          </p>
        )}

        {/* RMY-12: safety tip at the top of every chat, until hidden for this chat. */}
        {!tipHidden && (
          <div
            className="flex items-start gap-3 border-b border-[#e1ebe4] bg-sun/15 px-5 py-3"
            role="note"
            data-testid={MESSAGE_TEST_IDS.SAFETY_TIP}
          >
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden />
            <p className="min-w-0 flex-1 text-xs leading-5 text-ink">
              <span className="font-black text-amber-ink">{t('safety.tipTitle')}. </span>
              {t('safety.tipText')}
            </p>
            <button
              type="button"
              onClick={dismissTip}
              aria-label={t('safety.tipDismiss')}
              title={t('safety.tipDismiss')}
              className="-my-1 -mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sage transition-colors hover:bg-paper hover:text-pine"
              data-testid={MESSAGE_TEST_IDS.BUTTON_HIDE_SAFETY_TIP}
            >
              <X size={15} aria-hidden />
            </button>
          </div>
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
            messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                viewerRole={viewerRole}
                onReport={canModerate ? reportMessage : undefined}
              />
            ))
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
          {conversation?.blockedByMe && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-terracotta-mist px-4 py-3">
              <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-terracotta">{t('safety.blockedByMeNotice')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void changeBlock(false)}
                disabled={setBlocked.isPending}
                className="h-9 px-3"
                data-testid={MESSAGE_TEST_IDS.BUTTON_UNBLOCK}
              >
                {t('safety.unblock')}
              </Button>
            </div>
          )}
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
              maxLength={MESSAGE_MAX_LENGTH_CHARS}
              rows={1}
              placeholder={isClosed ? closedLabel : t('messages.writeMessage')}
              disabled={isClosed || sendMessage.isPending}
              className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#82978e]"
              data-testid={MESSAGE_TEST_IDS.INPUT_MESSAGE_BODY}
            />
            <Button
              type="submit"
              className="h-10 w-10 shrink-0 rounded-lg p-0"
              disabled={!body.trim() || isClosed || sendMessage.isPending}
              data-testid={MESSAGE_TEST_IDS.BUTTON_SEND_MESSAGE}
            >
              <Send size={16} />
            </Button>
          </div>
          {sendMessage.isError && (
            <p className="mt-2 text-xs font-bold text-[#a74b32]">
              {isClosed ? closedLabel : t('messages.sendError')}
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
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('messages.deleteChat')}</AlertDialogTitle>
            <AlertDialogDescription>{t('messages.deleteChatDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('messages.keepChat')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteChat()} data-testid={MESSAGE_TEST_IDS.BUTTON_CONFIRM_DELETE_CONVERSATION}>
              {t('messages.deleteChat')}
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
      <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <AlertDialogContent className="w-[300px] sm:w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('safety.blockTitle').replace('{name}', otherName)}</AlertDialogTitle>
            <AlertDialogDescription>{t('safety.blockText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('safety.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                // Keep the dialog open until the block is saved (closed in changeBlock).
                event.preventDefault();
                void changeBlock(true);
              }}
              disabled={setBlocked.isPending}
              className="bg-terracotta text-paper hover:bg-terracotta/90"
              data-testid={MESSAGE_TEST_IDS.BUTTON_CONFIRM_BLOCK}
            >
              {t('safety.blockConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {report && (
        <ReportDialog
          open
          onOpenChange={(open) => {
            if (!open) setReport(null);
          }}
          subject={report.subject}
          title={report.title}
        />
      )}
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
  // RMY-12: chats with people the viewer blocked leave the main list (shown under "Blocked").
  const visibleConversations = conversations.filter((item) => !item.blockedByMe);
  const blockedConversations = conversations.filter((item) => item.blockedByMe);
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
                {visibleConversations.length}
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
              <ConversationList
                conversations={visibleConversations}
                blocked={blockedConversations}
                selectedId={selectedId}
                owner={owner}
              />
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

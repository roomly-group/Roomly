import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Ban, BadgeCheck, Check, ChevronDown, ChevronLeft, Copy, Flag, Home, Mail, MapPin, MessageCircle, MoreHorizontal, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  customFetch,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  getGetListingQueryKey,
  getGetOwnerDashboardQueryKey,
  useGetListing,
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
import { useFormat } from '@/hooks/use-format';

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
/** How long the room shown beside a chat stays fresh before it is fetched again (ms). */
const LISTING_STALE_MS = 60000 as const;
/** Days back within which the inbox shows a weekday instead of a date (days). */
const INBOX_WEEKDAY_WINDOW_DAYS = 6 as const;
/** Number of milliseconds in one day (ms/day). */
const DAY_MS = 86400000 as const;
/** Chat page height: the viewport under the navbar (64px + 1px border), above the 76px tab bar on phones (CSS length). */
const CHAT_PAGE_HEIGHT = 'h-[calc(100dvh-65px-76px-env(safe-area-inset-bottom))] min-h-[420px] sm:h-[calc(100dvh-65px)]' as const;
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
  INPUT_SEARCH_CONVERSATIONS: 'input-search-conversations',
  PANEL_LISTING: 'panel-chat-listing',
  LINK_VIEW_LISTING: 'link-chat-view-listing',
} as const;

type Translate = ReturnType<typeof useLanguage>['t'];

/** Label and colors of a request status chip (in the inbox and the chat strip). */
function requestStatusChip(
  status: Conversation['requestStatus'],
  t: Translate,
): { text: string; dot: string } {
  switch (status) {
    case 'in_attesa':
      return { text: t('messages.status.in_attesa'), dot: 'bg-sun' };
    case 'accettata':
      return { text: t('messages.status.accettata'), dot: 'bg-shutter' };
    case 'rifiutata':
      return { text: t('messages.status.rifiutata'), dot: 'bg-terracotta' };
    case 'annullata':
      return { text: t('messages.status.annullata'), dot: 'bg-sage/50' };
    default:
      return { text: status, dot: 'bg-sage/50' };
  }
}

/** Midnight of the given date, local time, as a timestamp. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days between the date and today (0 = today, 1 = yesterday). */
function daysAgo(date: Date): number {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
}

/** Clock time of a message, e.g. "10:16". */
function formatClock(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(date);
}

/** Inbox timestamp: the time today, "Yesterday", a weekday this week, else a short date. */
function formatInboxTime(value: string, language: string, t: Translate): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const days = daysAgo(date);
  if (days <= 0) return formatClock(value, language);
  if (days === 1) return t('chat.yesterday');
  if (days <= INBOX_WEEKDAY_WINDOW_DAYS) return new Intl.DateTimeFormat(language, { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' }).format(date);
}

/** Day separator in the chat: "Today", "Yesterday" or a full date. */
function formatDayLabel(value: string, language: string, t: Translate): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const days = daysAgo(date);
  if (days <= 0) return t('chat.today');
  if (days === 1) return t('chat.yesterday');
  return new Intl.DateTimeFormat(language, { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

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
  const { t, language } = useLanguage();
  const mine = message.sender === viewerRole;
  // Its author deleted their account: the text is gone, only a placeholder is shown.
  const deleted = isDeletedMessage(message);
  const isSystem = message.kind === 'system';
  if (isSystem) {
    return (
      <div className="flex justify-center py-1" data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}>
        <p className="max-w-[90%] rounded-xl bg-cream px-3.5 py-2 text-center text-[13px] leading-5 text-sage">{message.body}</p>
      </div>
    );
  }
  // RMY-12: the other person's text with an IBAN, phone, messaging app or link gets a scam warning.
  const incoming = !mine && !deleted && message.id > 0;
  const flagged = incoming && looksLikeScamRisk(message.body);
  // Still being sent: shown at once, slightly faded until the server confirms it.
  const sending = message.id < 0;
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} data-testid={`${MESSAGE_TEST_IDS.MESSAGE_ROW_PREFIX}${message.id}`}>
      <div className="max-w-[80%] lg:max-w-[min(70%,600px)]">
        <div
          className={`rounded-[20px] px-4 py-3 text-[15px] leading-[1.5] lg:text-base ${
            mine
              ? 'rounded-br-[4px] bg-sun-soft text-sun-ink'
              : 'rounded-bl-[4px] bg-cream text-ink'
          } ${sending ? 'opacity-70' : ''}`}
        >
          <p className={`whitespace-pre-wrap break-words ${deleted ? 'italic opacity-80' : ''}`}>
            {deleted ? t('messages.deletedMessage') : message.body}
          </p>
          <div className="mt-1 flex items-center justify-end gap-1">
            {incoming && onReport ? (
              <button
                type="button"
                onClick={() => onReport(message.id)}
                aria-label={t('safety.reportMessage')}
                title={t('safety.reportMessage')}
                className="relative -my-1.5 grid h-7 w-7 place-items-center rounded-full text-sage transition-colors after:absolute after:-inset-2 after:content-[''] hover:bg-cream-deep hover:text-terracotta"
                data-testid={`${MESSAGE_TEST_IDS.BUTTON_REPORT_MESSAGE_PREFIX}${message.id}`}
              >
                <Flag size={12} aria-hidden />
              </button>
            ) : null}
            <time dateTime={message.sentAt} className={`text-[11px] tabular-nums ${mine ? 'text-sun-ink/80' : 'text-sage'}`}>
              {formatClock(message.sentAt, language)}
            </time>
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
  const { t, language } = useLanguage();
  // Opened by default when the chat on screen is one of the blocked ones.
  const [showBlocked, setShowBlocked] = useState(() => blocked.some((item) => item.id === selectedId));
  // Client-side filter on the person's name and the listing title.
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const matches = (conversation: Conversation) =>
    !needle ||
    participantName(conversation, t('messages.deletedUser')).toLocaleLowerCase().includes(needle) ||
    conversation.listingTitle.toLocaleLowerCase().includes(needle);
  const shown = conversations.filter(matches);
  const shownBlocked = blocked.filter(matches);

  const renderRow = (conversation: Conversation) => {
    const status = requestStatusChip(conversation.requestStatus, t);
    const name = participantName(conversation, t('messages.deletedUser'));
    const selected = selectedId === conversation.id;
    // Sage reads 4.3:1 on the darker selected row (below AA): a deeper green there.
    const muted = selected ? 'text-pine-text' : 'text-sage';
    return (
      <li key={conversation.id}>
        <Link
          href={`${owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}/${conversation.id}`}
          aria-current={selected ? 'page' : undefined}
          className={`flex items-center gap-3.5 rounded-2xl px-4 py-4 transition-colors ${
            selected ? 'bg-cream-deep' : 'hover:bg-cream-deep/50'
          } ${conversation.blockedByMe ? 'opacity-70' : ''}`}
          data-testid={`${MESSAGE_TEST_IDS.CONVERSATION_LINK_PREFIX}${conversation.id}`}
        >
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className={`truncate text-[15px] text-ink ${conversation.unread ? 'font-black' : 'font-bold'}`}>{name}</h3>
              <span className={`shrink-0 text-xs tabular-nums ${conversation.unread ? 'font-extrabold text-shutter' : muted}`}>
                {formatInboxTime(conversation.updatedAt, language, t)}
              </span>
            </div>
            <p className={`truncate text-[13px] ${muted}`}>{conversation.listingTitle}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <p className={`min-w-0 flex-1 truncate text-sm ${conversation.unread ? 'font-extrabold text-ink' : muted}`}>
                {conversation.preview}
              </p>
              {conversation.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-sun" aria-hidden />}
            </div>
            <span className={`mt-1.5 inline-flex items-center gap-1.5 text-xs ${muted}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
              {status.text}
            </span>
          </div>
        </Link>
      </li>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {conversations.length + blocked.length > 0 && (
        <div className="relative mx-5 mb-4">
          <label htmlFor="search-conversations" className="sr-only">{t('chat.searchLabel')}</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sage" aria-hidden />
          <input
            id="search-conversations"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('chat.searchPlaceholder')}
            className="h-12 w-full rounded-xl border border-field bg-cream pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-sage focus:border-shutter focus:ring-[3px] focus:ring-mint-wash/40"
            data-testid={MESSAGE_TEST_IDS.INPUT_SEARCH_CONVERSATIONS}
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {!conversations.length && !blocked.length ? (
          <EmptyState
            title={t('messages.inboxQuiet')}
            text={owner ? t('messages.emptyOwnerInbox') : t('messages.emptyStudentInbox')}
          />
        ) : shown.length ? (
          <ul className="space-y-1.5">{shown.map(renderRow)}</ul>
        ) : needle ? (
          <p className="px-3 py-6 text-center text-sm text-sage">{t('chat.noMatches')}</p>
        ) : null}
        {shownBlocked.length ? (
          <div className="mt-2 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => setShowBlocked((current) => !current)}
              aria-expanded={showBlocked}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-sm font-extrabold text-sage transition-colors hover:bg-cream-deep/50"
              data-testid={MESSAGE_TEST_IDS.BUTTON_TOGGLE_BLOCKED}
            >
              <span className="flex items-center gap-2">
                <Ban size={15} aria-hidden />
                {t('safety.blockedSection').replace('{n}', String(shownBlocked.length))}
              </span>
              <ChevronDown size={16} className={`transition-transform ${showBlocked ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {showBlocked ? <ul className="mt-1 space-y-1.5">{shownBlocked.map(renderRow)}</ul> : null}
          </div>
        ) : null}
      </div>
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
  const { t, language } = useLanguage();
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
  // Timer hiding the "Copied" feedback: cleared on unmount so it never fires on a closed chat (RMY-24).
  const copiedTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), []);
  const [serverClosedChat, setServerClosedChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The same inbox lists chats where the person is the student AND chats where
  // they are the owner, so "mine" depends on the role in THIS conversation.
  const viewerRole: 'owner' | 'student' = conversation?.role ?? (owner ? 'owner' : 'student');
  const format = useFormat();
  const status = conversation ? requestStatusChip(conversation.requestStatus, t) : null;
  // The room this chat is about: price for the header and strip (shared cache with the listing panel).
  const roomId = conversation?.roomId ?? 0;
  const { data: listing } = useGetListing(roomId, {
    query: { queryKey: getGetListingQueryKey(roomId), enabled: roomId > 0, retry: false, staleTime: LISTING_STALE_MS },
  });

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
      // RMY-24: the failure used to be silent; now the user knows the chat is still there.
      toast({ title: t('messages.actionFailed'), variant: 'destructive' });
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

  // RMY-24: "Copied" only when the copy really worked (the clipboard can be
  // missing or refused, e.g. without HTTPS or permission); the feedback timer
  // is replaced on a new copy and cleared when the chat closes.
  const copyListing = () => {
    const title = conversation?.listingTitle;
    if (!title) return;
    const copy = navigator.clipboard?.writeText(title) ?? Promise.reject(new Error('Clipboard unavailable'));
    copy
      .then(() => {
        setCopied(true);
        if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopied(false), COPY_FEEDBACK_RESET_MS);
      })
      .catch(() => {
        toast({ title: t('messages.actionFailed'), variant: 'destructive' });
      });
  };

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-cream-deep">
        <header className="flex items-center gap-3 border-b border-line bg-cream py-3 pl-2 pr-3 lg:py-5 lg:pl-8 lg:pr-6">
          <Link
            href={owner ? APP_ROUTES.OWNER_MESSAGES : APP_ROUTES.MESSAGES}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink transition-colors hover:bg-cream-deep lg:hidden"
            aria-label={t('messages.back')}
            data-testid={MESSAGE_TEST_IDS.LINK_BACK_TO_INBOX}
          >
            <ChevronLeft size={22} aria-hidden />
          </Link>
          {conversation && <Avatar name={otherName} />}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-black leading-tight lg:text-lg text-ink">
              {conversation ? otherName : t('messages.conversationFallback')}
              {conversation && !conversation.participantDeleted && (
                <span className="font-normal text-sage"> · {t(viewerRole === 'student' ? 'chat.roleOwner' : 'chat.roleStudent')}</span>
              )}
            </h2>
            <p className="truncate text-xs leading-5 text-sage lg:text-sm">
              {conversation?.listingTitle ?? t('messages.roomlyMessagesFallback')}
              {viewerRole === 'student' && listing?.zone ? ` · ${listing.zone}` : ''}
            </p>
          </div>
          {viewerRole === 'student' && listing && (
            <span className="shrink-0 whitespace-nowrap rounded-lg bg-cream-deep px-2 py-1.5 text-xs font-extrabold text-ink">
              {format.price(listing.price)}
              {t('chat.perMonth')}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sage transition-colors hover:bg-cream-deep hover:text-ink"
                data-testid={MESSAGE_TEST_IDS.BUTTON_CONVERSATION_MORE}
                aria-label={t('messages.moreOptions')}
              >
                <MoreHorizontal size={20} aria-hidden />
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
              {canModerate && (
                <>
                  <DropdownMenuItem onSelect={reportPerson} className="text-terracotta" data-testid={MESSAGE_TEST_IDS.MENU_REPORT_USER}>
                    <Flag size={15} className="mr-2" /> {t('safety.reportUser').replace('{name}', otherName)}
                  </DropdownMenuItem>
                  {conversation?.blockedByMe ? (
                    <DropdownMenuItem onSelect={() => void changeBlock(false)} data-testid={MESSAGE_TEST_IDS.MENU_BLOCK_USER}>
                      <Ban size={15} className="mr-2" /> {t('safety.unblock')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={() => setShowBlockDialog(true)}
                      className="text-terracotta"
                      data-testid={MESSAGE_TEST_IDS.MENU_BLOCK_USER}
                    >
                      <Ban size={15} className="mr-2" /> {t('safety.block').replace('{name}', otherName)}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Info strip: what the chat is about, the request status and the actions on it. */}
        {conversation && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-cream px-4 py-2.5 lg:px-8 lg:py-3.5">
            <p className="flex min-w-0 flex-1 basis-56 items-center gap-2 text-xs text-sage lg:text-sm">
              <MapPin size={16} className="shrink-0 text-shutter" aria-hidden />
              <span className="truncate">
                {viewerRole === 'owner'
                  ? t('chat.forListing').replace(
                      '{title}',
                      listing ? `${conversation.listingTitle} · ${format.price(listing.price)}${t('chat.perMonth')}` : conversation.listingTitle,
                    )
                  : listing?.zone ?? conversation.listingTitle}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {status && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
                  <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden />
                  {status.text}
                </span>
              )}
              {conversation.roomStatus === 'affittata' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sage">
                  <span className="h-2 w-2 rounded-full bg-sage/50" aria-hidden />
                  {t('messages.roomRented')}
                </span>
              )}
              {conversation.requestStatus === 'in_attesa' && conversation.role === 'owner' && (
                <>
                  {/* A blocked person cannot be accepted (the backend refuses it too). */}
                  {!isBlocked && (
                    <Button
                      onClick={() => setShowAcceptDialog(true)}
                      disabled={actionPending}
                      data-testid={MESSAGE_TEST_IDS.BUTTON_ACCEPT_CONVERSATION}
                      className="h-10 rounded-xl px-4"
                    >
                      <Check size={16} aria-hidden /> {t('messages.accept')}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowRejectDialog(true)}
                    disabled={actionPending}
                    data-testid={MESSAGE_TEST_IDS.BUTTON_REJECT_CONVERSATION}
                    className="h-10 rounded-xl px-4"
                  >
                    <X size={16} aria-hidden /> {t('messages.reject')}
                  </Button>
                </>
              )}
              {conversation.requestStatus === 'in_attesa' && conversation.role === 'student' && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={actionPending}
                  data-testid={MESSAGE_TEST_IDS.BUTTON_CANCEL_CONVERSATION}
                  className="h-10 rounded-xl px-4"
                >
                  <X size={16} aria-hidden /> {t('messages.cancelRequest')}
                </Button>
              )}
              {conversation.requestStatus === 'accettata' && conversation.role === 'owner' && (
                <Button
                  variant="outline"
                  onClick={() => setShowReleaseDialog(true)}
                  disabled={actionPending}
                  data-testid={MESSAGE_TEST_IDS.BUTTON_RELEASE_LISTING}
                  className="h-10 rounded-xl px-4"
                >
                  {t('messages.releaseRoom')}
                </Button>
              )}
            </div>
          </div>
        )}

        {copied && (
          <p
            className="border-b border-line bg-cream px-4 py-2 text-xs font-extrabold text-ink"
            data-testid={MESSAGE_TEST_IDS.STATUS_LISTING_COPIED}
          >
            {t('messages.listingNameCopied')}
          </p>
        )}

        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-16 lg:py-10">
          <div className="flex min-h-full flex-col justify-end gap-3 lg:gap-4">
            {/* RMY-12: safety tip at the top of every chat, until hidden for this chat. */}
            {!tipHidden && (
              <div
                className="mb-1 flex items-start gap-2 self-center rounded-xl bg-cream px-3 py-2 text-xs leading-5 text-ink sm:max-w-[90%]"
                role="note"
                data-testid={MESSAGE_TEST_IDS.SAFETY_TIP}
              >
                <ShieldAlert size={15} className="mt-0.5 shrink-0 text-amber-ink" aria-hidden />
                <p className="min-w-0 flex-1">
                  <span className="font-black">{t('safety.tipTitle')}. </span>
                  {t('safety.tipText')}
                </p>
                <button
                  type="button"
                  onClick={dismissTip}
                  aria-label={t('safety.tipDismiss')}
                  title={t('safety.tipDismiss')}
                  className="relative -my-1.5 -mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sage transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-cream-deep hover:text-ink"
                  data-testid={MESSAGE_TEST_IDS.BUTTON_HIDE_SAFETY_TIP}
                >
                  <X size={15} aria-hidden />
                </button>
              </div>
            )}
            {loadingOlder && <div className="skeleton mx-auto h-4 w-24 rounded-full" />}
            {isLoading ? (
              <>
                {[1, 2, 3].map((item) => (
                  <div key={item} className={`skeleton h-12 w-2/3 rounded-[18px] ${item % 2 ? '' : 'ml-auto'}`} />
                ))}
              </>
            ) : isError ? (
              <QueryError onRetry={() => refetch()} />
            ) : messages.length ? (
              messages.map((message, index) => {
                // Day separator before the first message of each calendar day.
                const day = formatDayLabel(message.sentAt, language, t);
                const previousDay = index > 0 ? formatDayLabel(messages[index - 1].sentAt, language, t) : '';
                return (
                  <Fragment key={message.id}>
                    {day && day !== previousDay && (
                      <p className="self-center pt-2 text-[11px] font-bold uppercase tracking-[0.04em] text-pine-text">{day}</p>
                    )}
                    <MessageBubble
                      message={message}
                      viewerRole={viewerRole}
                      onReport={canModerate ? reportMessage : undefined}
                    />
                  </Fragment>
                );
              })
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="rounded-xl bg-cream p-3 text-sage">
                  <Mail size={22} aria-hidden />
                </div>
                <p className="mt-3 font-black text-ink">{t('messages.startConversation')}</p>
                <p className="mt-1 text-sm text-sage">{t('messages.startConversationText')}</p>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="border-t border-line bg-cream px-3 pb-3 pt-2.5 lg:px-8 lg:py-6">
          {conversation?.blockedByMe && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-terracotta-mist px-4 py-3">
              <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-terracotta">{t('safety.blockedByMeNotice')}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void changeBlock(false)}
                disabled={setBlocked.isPending}
                className="h-11 px-4"
                data-testid={MESSAGE_TEST_IDS.BUTTON_UNBLOCK}
              >
                {t('safety.unblock')}
              </Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label htmlFor={`message-body-${conversationId}`} className="sr-only">{t('messages.writeMessage')}</label>
            <textarea
              id={`message-body-${conversationId}`}
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
              className="max-h-28 min-h-11 min-w-0 flex-1 resize-none rounded-[22px] border border-field bg-cream px-4 py-[11px] text-[15px] leading-5 text-ink outline-none transition-colors placeholder:text-sage focus:border-shutter focus:ring-[3px] focus:ring-mint-wash/40 disabled:cursor-not-allowed"
              data-testid={MESSAGE_TEST_IDS.INPUT_MESSAGE_BODY}
            />
            <button
              type="submit"
              aria-label={t('chat.send')}
              title={t('chat.send')}
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors disabled:cursor-not-allowed ${
                body.trim() && !isClosed ? 'bg-sun text-ink hover:bg-sun-hover' : 'bg-cream-deep text-sage'
              }`}
              disabled={!body.trim() || isClosed || sendMessage.isPending}
              data-testid={MESSAGE_TEST_IDS.BUTTON_SEND_MESSAGE}
            >
              <ArrowRight size={22} aria-hidden />
            </button>
          </div>
          {sendMessage.isError && (
            <p className="mt-2 text-xs font-bold text-terracotta">
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

/** The room a chat is about, beside the chat on wide screens. */
function ListingPanel({ conversation }: { conversation: Conversation }) {
  const { t } = useLanguage();
  const format = useFormat();
  const roomId = conversation.roomId;
  const { data: listing, isLoading } = useGetListing(roomId, {
    query: { queryKey: getGetListingQueryKey(roomId), enabled: roomId > 0, retry: false, staleTime: LISTING_STALE_MS },
  });
  const isOwnerView = conversation.role === 'owner';
  const photo = listing?.coverPhotoUrl ?? listing?.photoUrls?.[0];

  return (
    <aside
      aria-label={t('chat.listingPanel')}
      className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-l border-line bg-cream p-8 xl:flex"
      data-testid={MESSAGE_TEST_IDS.PANEL_LISTING}
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.05em] text-sage">
        {isOwnerView ? t('chat.yourListing') : t('chat.theRoom')}
      </p>
      {isLoading ? (
        <>
          <div className="skeleton h-[220px] rounded-xl" />
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </>
      ) : (
        <>
          {photo ? (
            <img src={photo} alt="" className="h-[220px] w-full rounded-xl object-cover" />
          ) : (
            <div className="grid h-[220px] place-items-center rounded-xl bg-cream-deep text-sage" aria-hidden>
              <Home size={28} />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xl font-black leading-snug text-ink">{listing?.title ?? conversation.listingTitle}</p>
            {listing?.zone && (
              <p className="flex items-center gap-1.5 text-sm text-sage">
                <MapPin size={15} className="shrink-0 text-shutter" aria-hidden />
                {listing.zone}
              </p>
            )}
            {listing && (
              <p className="pt-1 text-xl font-black text-shutter">
                {format.price(listing.price)}
                <span className="text-sm font-medium text-sage"> {t('chat.perMonth')}</span>
              </p>
            )}
          </div>
          {conversation.roomStatus === 'affittata' && !isOwnerView && (
            <p className="flex items-center gap-2 text-sm font-bold text-sage">
              <span className="h-2 w-2 rounded-full bg-sage/50" aria-hidden />
              {t('chat.roomTaken')}
            </p>
          )}
          {listing?.ownerVerified && (
            <p className="flex items-start gap-2 text-sm leading-5 text-ink">
              <BadgeCheck size={18} className="mt-px shrink-0 text-shutter" aria-hidden />
              {t('chat.ownerVerified')}
            </p>
          )}
          <Link
            href={APP_ROUTES.LISTING_DETAIL.replace(':id', String(roomId))}
            className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-field px-4 text-sm font-extrabold text-shutter transition-colors hover:bg-cream-deep"
            data-testid={MESSAGE_TEST_IDS.LINK_VIEW_LISTING}
          >
            {t('chat.viewListing')} <ArrowRight size={16} aria-hidden />
          </Link>
        </>
      )}
    </aside>
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
  const conversations = useMemo(() => data ?? [], [data]);
  // RMY-12: chats with people the viewer blocked leave the main list (shown under "Blocked").
  const visibleConversations = conversations.filter((item) => !item.blockedByMe);
  const blockedConversations = conversations.filter((item) => item.blockedByMe);
  // No conversation is auto-opened: the right panel starts on the
  // "select a contact" placeholder until the person picks one from the inbox.
  const selectedId = id ? Number(id) : undefined;
  const selectedConversation = selectedId ? conversations.find((item) => item.id === selectedId) : undefined;

  return (
    <AppShell hideFooter fullWidth>
      {/* Full-page chat under the navbar, like a messaging app: inbox, chat and room side by side. */}
      <h1 className="sr-only">{t('messages.inbox')}</h1>
      <div
        className={`grid grid-cols-1 overflow-hidden bg-cream ${CHAT_PAGE_HEIGHT} lg:grid-cols-[360px_minmax(0,1fr)] ${
          selectedConversation ? 'xl:grid-cols-[380px_minmax(0,1fr)_400px]' : 'xl:grid-cols-[380px_minmax(0,1fr)]'
        }`}
      >
          <section
            aria-label={t('messages.inbox')}
            className={`min-h-0 flex-col border-line pt-7 lg:flex lg:border-r ${selectedId ? 'hidden' : 'flex'}`}
          >
            <div className="flex items-center justify-between px-7 pb-4">
              <h2 className="text-2xl font-black text-ink">{t('messages.inbox')}</h2>
              <span className="rounded-full bg-cream-deep px-2.5 py-1 text-xs font-black tabular-nums text-ink">
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

          <section className={`min-h-0 ${selectedId ? 'block' : 'hidden lg:block'}`}>
            {selectedId ? (
              <ConversationPanel
                conversationId={selectedId}
                conversation={selectedConversation}
                owner={owner}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-cream-deep/60 p-8 text-center">
                <MessageCircle size={30} className="mb-3 text-mint-wash" aria-hidden />
                <p className="font-black text-ink">{t('messages.pickConversation')}</p>
                <p className="mt-1 text-sm text-sage">{t('messages.pickConversationText')}</p>
              </div>
            )}
          </section>

          {selectedConversation && <ListingPanel conversation={selectedConversation} />}
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

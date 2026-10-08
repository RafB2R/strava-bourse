import {
  Flame, Pin, Building2, Building, Landmark, Globe, Users, User, Home, Search, BarChart3, TrendingUp, TrendingDown,
  LineChart, PieChart, Image, Paperclip, MessageCircle, ThumbsUp, Pencil, Trash2, X, Check, CheckCircle2, AlertTriangle,
  Lock, Trophy, Award, Sparkles, Star, Coins, Wallet, Briefcase, Target, Shield, Mountain, Calendar, CalendarDays, Clock,
  Bell, Mail, Send, Share2, Eye, Camera, Newspaper, Lightbulb, Sun, Moon, Rocket, Handshake, Scale, Compass, Megaphone,
  Wrench, Hand, Link2, Cake, Gift, Gem, Factory, Repeat, ArrowLeftRight, Bitcoin, Zap, BookOpen, FileText, ClipboardList,
  Smile, CornerDownLeft, Timer, HeartHandshake, Leaf, Receipt, Plus, LogOut, Settings, ChevronRight, ChevronLeft, Filter, Layers,
} from "lucide-react";

// Icônes de l'interface (Lucide, trait fin) à la place des emojis.
// <Icon name="flame" /> ou <Icon emoji="🔥" /> : les données (badges, moments, notifications…)
// peuvent garder leur emoji comme identifiant, l'affichage le remplace par l'icône.
// Les médailles des badges (🥉🥈🥇💎) et les drapeaux restent des emojis.

const ICONS = {
  flame: Flame, pin: Pin, building: Building2, company: Building, landmark: Landmark, globe: Globe, users: Users, user: User,
  home: Home, search: Search, chart: BarChart3, up: TrendingUp, down: TrendingDown, line: LineChart, pie: PieChart,
  image: Image, clip: Paperclip, comment: MessageCircle, like: ThumbsUp, edit: Pencil, trash: Trash2, close: X, check: Check,
  ok: CheckCircle2, warning: AlertTriangle, lock: Lock, trophy: Trophy, award: Award, sparkles: Sparkles, star: Star,
  coins: Coins, wallet: Wallet, briefcase: Briefcase, target: Target, shield: Shield, mountain: Mountain, calendar: Calendar,
  calendarDays: CalendarDays, clock: Clock, bell: Bell, mail: Mail, send: Send, share: Share2, eye: Eye, camera: Camera,
  news: Newspaper, idea: Lightbulb, sun: Sun, moon: Moon, rocket: Rocket, handshake: Handshake, scale: Scale, compass: Compass,
  megaphone: Megaphone, wrench: Wrench, hand: Hand, link: Link2, cake: Cake, gift: Gift, gem: Gem, factory: Factory,
  repeat: Repeat, exchange: ArrowLeftRight, bitcoin: Bitcoin, zap: Zap, book: BookOpen, file: FileText, list: ClipboardList,
  smile: Smile, enter: CornerDownLeft, timer: Timer, care: HeartHandshake, leaf: Leaf, receipt: Receipt, plus: Plus,
  logout: LogOut, settings: Settings, next: ChevronRight, prev: ChevronLeft, filter: Filter, layers: Layers,
};

// Emoji → nom d'icône (pour les données qui gardent un emoji comme identifiant)
const EMOJI_ICONS = {
  "🔥": "flame", "📌": "pin", "🏢": "building", "🏛️": "landmark", "🏛": "landmark", "🏦": "landmark", "🌍": "globe", "👥": "users",
  "👤": "user", "🏠": "home", "🔍": "search", "📊": "chart", "📈": "up", "📉": "down", "🥧": "pie", "🖼️": "image", "📎": "clip",
  "💬": "comment", "👍": "like", "✏️": "edit", "🗑️": "trash", "✕": "close", "✗": "close", "✓": "check", "✅": "ok", "⚠️": "warning",
  "🔒": "lock", "🏆": "trophy", "🏅": "award", "🌟": "sparkles", "✨": "sparkles", "⭐": "star", "💰": "coins", "🪙": "coins",
  "💼": "briefcase", "🎯": "target", "🛡️": "shield", "🏔️": "mountain", "📅": "calendar", "🕐": "clock", "⏱️": "timer",
  "🔔": "bell", "✉️": "mail", "➤": "send", "📤": "share", "👁️": "eye", "📷": "camera", "📸": "camera", "📰": "news",
  "💡": "idea", "☀️": "sun", "🌙": "moon", "🚀": "rocket", "🤝": "handshake", "⚖️": "scale", "🧭": "compass", "📣": "megaphone",
  "🔧": "wrench", "✋": "hand", "🔗": "link", "🎂": "cake", "🎄": "gift", "🧘": "leaf", "🌱": "leaf", "🏭": "factory",
  "💱": "exchange", "⚡": "zap", "📗": "book", "📘": "book", "📙": "book", "📄": "file", "📋": "list", "🧾": "receipt",
  "🙂": "smile", "👋": "hand", "↵": "enter", "↩": "enter", "🔮": "sparkles", "🎁": "gift",
};

export default function Icon({ name, emoji, size = 16, strokeWidth = 1.75, style, ...rest }) {
  const key = name || EMOJI_ICONS[emoji];
  const Comp = ICONS[key];
  if (!Comp) return emoji ? <span aria-hidden="true" style={style}>{emoji}</span> : null;
  return <Comp size={size} strokeWidth={strokeWidth} aria-hidden="true" style={{ flexShrink: 0, verticalAlign: "-0.15em", ...style }} {...rest} />;
}

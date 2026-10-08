import {
  Flame, Pin, Building2, Building, Landmark, Globe, Users, User, Home, Search, BarChart3, TrendingUp, TrendingDown,
  LineChart, PieChart, Image, Paperclip, MessageCircle, ThumbsUp, Pencil, Trash2, X, Check, CheckCircle2, AlertTriangle,
  Lock, Trophy, Award, Sparkles, Star, Coins, Wallet, Briefcase, Target, Shield, Mountain, Calendar, CalendarDays, Clock,
  Bell, Mail, Send, Share2, Eye, Camera, Newspaper, Lightbulb, Sun, Moon, Rocket, Handshake, Scale, Compass, Megaphone,
  Wrench, Hand, Link2, Cake, Gift, Gem, Factory, Repeat, ArrowLeftRight, Bitcoin, Zap, BookOpen, FileText, ClipboardList,
  Smile, CornerDownLeft, Timer, HeartHandshake, Leaf, Receipt, Plus, LogOut, Settings, ChevronRight, ChevronLeft, Filter, Layers,
} from "lucide-react";

// Icônes dessinées dans le style Lucide (24×24, trait), pour ce que Lucide n'a pas
const svgProps = (size, strokeWidth) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" });
function Lion({ size = 24, strokeWidth = 1.75, ...rest }) {
  return (
    <svg {...svgProps(size, strokeWidth)} {...rest}>
      <path d="M12 3.4Q14.9 1.18 16.3 4.55Q19.92 4.08 19.45 7.7Q22.82 9.1 20.6 12Q22.82 14.9 19.45 16.3Q19.92 19.92 16.3 19.45Q14.9 22.82 12 20.6Q9.1 22.82 7.7 19.45Q4.08 19.92 4.55 16.3Q1.18 14.9 3.4 12Q1.18 9.1 4.55 7.7Q4.08 4.08 7.7 4.55Q9.1 1.18 12 3.4Z" />
      <circle cx="12" cy="12.4" r="5.4" />
      <path d="M10 11.2h.01M14 11.2h.01" />
      <path d="M11.1 13.3h1.8L12 14.3z" />
      <path d="M12 14.3v.7M10.7 15.6c.6.4 1 .3 1.3-.6.3.9.7 1 1.3.6" />
    </svg>
  );
}
function Horse({ size = 24, strokeWidth = 1.75, ...rest }) {
  return (
    <svg {...svgProps(size, strokeWidth)} {...rest}>
      <path d="M6.5 21h11" />
      <path d="M8 21c0-3.5 1.6-5.4 3.6-6.8L8 13.6c-.8-.3-1.1-1.2-.6-1.9L10 8l.5-3 2 1.5c3.4.6 5.5 3.6 5.5 8.5V21" />
      <path d="M12.6 9.4h.01" />
    </svg>
  );
}

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
  lion: Lion, horse: Horse,
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
  // Légendes
  "🦁": "lion", "🐎": "horse", "🛡": "shield", "🏔": "mountain", "💎": "gem",
};

export default function Icon({ name, emoji, size = 16, strokeWidth = 1.75, style, ...rest }) {
  const key = name || EMOJI_ICONS[emoji];
  const Comp = ICONS[key];
  if (!Comp) return emoji ? <span aria-hidden="true" style={style}>{emoji}</span> : null;
  return <Comp size={size} strokeWidth={strokeWidth} aria-hidden="true" style={{ flexShrink: 0, verticalAlign: "-0.15em", ...style }} {...rest} />;
}

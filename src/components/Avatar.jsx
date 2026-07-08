export default function Avatar({ initials, bg, color, size = 36 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, display: "flex", alignItems: "center",
      justifyContent: "center", fontSize: size * 0.33,
      fontWeight: 500, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

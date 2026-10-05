// Drapeaux en SVG : les emojis drapeaux ne s'affichent pas sous Windows (« FR », « US »).
const W = 21, H = 14;

const FLAGS = {
  fr: (
    <>
      <rect width="7" height="14" fill="#0055A4" />
      <rect x="7" width="7" height="14" fill="#FFFFFF" />
      <rect x="14" width="7" height="14" fill="#EF4135" />
    </>
  ),
  de: (
    <>
      <rect width="21" height="4.67" fill="#000000" />
      <rect y="4.67" width="21" height="4.67" fill="#DD0000" />
      <rect y="9.33" width="21" height="4.67" fill="#FFCE00" />
    </>
  ),
  jp: (
    <>
      <rect width="21" height="14" fill="#FFFFFF" />
      <circle cx="10.5" cy="7" r="4.2" fill="#BC002D" />
    </>
  ),
  us: (
    <>
      <rect width="21" height="14" fill="#FFFFFF" />
      {[0, 2, 4, 6, 8, 10, 12].map(i => <rect key={i} y={i * (14 / 13)} width="21" height={14 / 13} fill="#B22234" />)}
      <rect width="9" height={14 * 7 / 13} fill="#3C3B6E" />
    </>
  ),
  eu: (
    <>
      <rect width="21" height="14" fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * 2 * Math.PI;
        return <circle key={i} cx={10.5 + 4.2 * Math.sin(a)} cy={7 - 4.2 * Math.cos(a)} r="0.75" fill="#FFCC00" />;
      })}
    </>
  ),
};

export default function Flag({ country, size = 14 }) {
  const content = FLAGS[country];
  if (!content) return null;
  return (
    <svg width={(size * W) / H} height={size} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={country.toUpperCase()}
      style={{ display: "inline-block", verticalAlign: "-2px", borderRadius: 2, boxShadow: "0 0 0 0.5px rgba(0,0,0,0.25)", marginRight: 6, flexShrink: 0 }}>
      {content}
    </svg>
  );
}

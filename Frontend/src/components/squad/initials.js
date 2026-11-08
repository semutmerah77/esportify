// "NightFury" -> "NF", "Putra Ananda" -> "PA", "rex" -> "RE"
export default function initials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const caps = name.match(/[A-Z]/g);
  if (caps && caps.length >= 2) return caps[0] + caps[1];
  return name.slice(0, 2).toUpperCase();
}

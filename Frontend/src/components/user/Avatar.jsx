import { useEffect, useState } from "react";

// Tampil foto kalau ada, kalau tidak (atau gagal dimuat) tampil inisial username
function Avatar({ src, name = "", size = 36 }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <span
      className="user-avatar"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => {
            // SEMENTARA buat debug: hapus baris ini kalau avatar sudah muncul
            console.warn("[Avatar] gagal dimuat dari URL:", src);
            setFailed(true);
          }}
        />
      ) : (
        name.charAt(0).toUpperCase() || "•"
      )}
    </span>
  );
}

export default Avatar;

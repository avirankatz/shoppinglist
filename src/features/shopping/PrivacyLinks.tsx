type Props = { isRtl: boolean; accountId?: string };

export function PrivacyLinks({ isRtl, accountId }: Props) {
  const base = import.meta.env.BASE_URL;
  const body = `Please delete my Shopping List account and associated data.\nAccount ID: ${accountId || "unknown — please help me identify it"}\nI understand owned lists will be deleted for all members.`;
  const email = `mailto:aviran.katz@gmail.com?subject=Shopping%20List%20account%20deletion&body=${encodeURIComponent(body)}`;
  return (
    <footer dir={isRtl ? "rtl" : "ltr"} className="flex flex-wrap justify-center gap-4 px-4 py-4 text-sm text-[var(--muted-foreground)]">
      <a className="underline" href={`${base}privacy.html${isRtl ? "#he" : ""}`}>
        {isRtl ? "מדיניות פרטיות" : "Privacy policy"}
      </a>
      <a className="underline" href={email}>
        {isRtl ? "בקשת מחיקת חשבון" : "Request account deletion"}
      </a>
      <a className="underline" href={`${base}delete-account.html${isRtl ? "#he" : ""}`}>
        {isRtl ? "פרטי תהליך המחיקה" : "Deletion details"}
      </a>
    </footer>
  );
}

import Link from "next/link";
import { slugForCategoryName } from "@/lib/categories";

export default function CategoryChip({ name, link = true }: { name: string; link?: boolean }) {
  if (!link) return <span className="chip">{name}</span>;
  return (
    <Link href={`/archive?category=${slugForCategoryName(name)}`} className="chip chip-interactive">
      {name}
    </Link>
  );
}

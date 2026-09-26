import Link from "next/link";
import { slugForCategoryName } from "@/lib/categories";
import { collectionPath } from "@/lib/seo";

export default function CategoryChip({ name, link = true }: { name: string; link?: boolean }) {
  if (!link) return <span className="chip">{name}</span>;
  return (
    <Link href={collectionPath(slugForCategoryName(name))} className="chip chip-interactive">
      {name}
    </Link>
  );
}

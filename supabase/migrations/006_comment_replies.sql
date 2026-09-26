-- ============================================================
-- Witness Archive — migration 006: threaded replies on comments
-- Run after 005. One level of nesting: a reply points at a top-level comment.
-- ============================================================

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_idx on public.comments (parent_id, created_at);

-- Keep threads one level deep: a reply's parent must itself be top-level.
create or replace function public.comments_one_level()
returns trigger language plpgsql as $$
begin
  if new.parent_id is not null then
    if exists (select 1 from public.comments c where c.id = new.parent_id and c.parent_id is not null) then
      raise exception 'Replies can only be made to top-level comments';
    end if;
    -- A reply lives on the same testimony as its parent.
    select c.testimony_id into new.testimony_id from public.comments c where c.id = new.parent_id;
  end if;
  return new;
end $$;

drop trigger if exists comments_one_level_trg on public.comments;
create trigger comments_one_level_trg before insert on public.comments
  for each row execute function public.comments_one_level();

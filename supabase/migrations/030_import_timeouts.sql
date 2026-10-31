-- ============================================================
-- Witness Archive — migration 030: stop import jobs looping on timeouts
-- Run after 029. A job left in "processing" (the runner was cut off, e.g.
-- the caller disconnected or the worker hit a limit) is picked up again
-- after 15 minutes — but only twice more. On the 3rd stall it is marked
-- failed with reason_code 'timeout' instead of looping forever.
-- ============================================================

create or replace function public.claim_import_job()
returns setof public.import_jobs
language plpgsql
as $$
begin
  update public.import_jobs
     set status = 'failed',
         reason_code = 'timeout',
         reason = 'Processing was cut off 3 times (usually a very long video, or the caller stopped waiting). Send the transcript with the request, or POST the video again to retry.',
         updated_at = now(),
         finished_at = now()
   where status = 'processing'
     and started_at < now() - interval '15 minutes'
     and attempts >= 3;

  return query
  update public.import_jobs j
     set status = 'processing', attempts = j.attempts + 1, started_at = now(), updated_at = now()
   where j.id = (
     select id from public.import_jobs
      where (status = 'queued' and next_attempt_at <= now())
         or (status = 'blocked' and attempts < 6 and next_attempt_at <= now())
         or (status = 'processing' and started_at < now() - interval '15 minutes' and attempts < 3)
      order by (status = 'queued') desc, created_at
      limit 1
      for update skip locked
   )
  returning j.*;
end $$;
revoke all on function public.claim_import_job() from public, anon, authenticated;
grant execute on function public.claim_import_job() to service_role;

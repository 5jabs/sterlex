-- Migration date: 2026-07-09

-- Add the missing `workflow` column on chat_messages.
--
-- The backend has always tried to persist the selected-workflow marker
-- (`{id, title}`) alongside a user's chat message (routes/chat.ts and
-- routes/projectChat.ts insert a `workflow` field), but no migration ever
-- created the column. Postgres rejects an insert referencing an unknown
-- column, and since the insert's result was never checked for an error,
-- every user-turn insert into chat_messages has been silently failing —
-- only assistant messages (which don't set this field) were ever saved.
--
-- Safe to run repeatedly: only adds a nullable column if missing.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS workflow jsonb;

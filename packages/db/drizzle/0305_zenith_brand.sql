-- Zenith branding. Keep historical migrations unchanged for existing installations.
ALTER TABLE settings ALTER COLUMN assistant_config SET DEFAULT '{"version":4,"identity":{"name":"Zenith Assistant","avatarUrl":null},"agents":{"agent":{"voice":{"tone":"balanced","responseLength":"balanced","additionalInstructions":""},"knowledge":{"helpCenter":true,"posts":false,"changelog":false,"documents":true,"status":false},"toolRules":{}},"copilot":{"capabilities":{"qa":true},"knowledge":{"helpCenter":true,"posts":true,"pastConversations":true,"internalNotes":true,"tickets":true,"changelog":true,"documents":true,"status":true},"toolRules":{}},"workspace":{"capabilities":{"qa":true},"knowledge":{"helpCenter":true,"posts":true,"pastConversations":true,"internalNotes":true,"tickets":true,"changelog":true,"documents":true,"status":true},"toolRules":{},"instructions":"","slack":{"enabled":false,"respondTo":"mentions_and_dms","allowUnlinkedPublicQa":false}}}}'::jsonb;
--> statement-breakpoint
UPDATE settings
SET assistant_config = jsonb_set(assistant_config, '{identity,name}', '"Zenith Assistant"'::jsonb)
WHERE assistant_config #>> '{identity,name}' = 'Quinn';
--> statement-breakpoint
ALTER FUNCTION quackback_widget_session_scope() RENAME TO zenith_widget_session_scope;

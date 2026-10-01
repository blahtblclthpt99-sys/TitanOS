CREATE OR REPLACE FUNCTION private.is_titan_comms_member(target_channel_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_channel_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.titan_comms_members m WHERE m.channel_id=target_channel_id AND m.user_id=(SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION private.is_titan_comms_creator(target_channel_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_channel_id IS NOT NULL AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=target_channel_id AND c.created_by_id=(SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION private.is_titan_comms_public_unprotected(target_channel_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=target_channel_id AND c.kind='public' AND COALESCE(c.is_password_protected,false)=false);
$$;
CREATE OR REPLACE FUNCTION private.is_titan_comms_public(target_channel_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT target_channel_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.titan_comms_channels c WHERE c.id=target_channel_id AND c.kind='public');
$$;
REVOKE ALL ON FUNCTION private.is_titan_comms_member(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.is_titan_comms_creator(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.is_titan_comms_public_unprotected(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.is_titan_comms_public(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_titan_comms_member(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.is_titan_comms_creator(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.is_titan_comms_public_unprotected(uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.is_titan_comms_public(uuid) TO authenticated,service_role;

DROP POLICY IF EXISTS titan_comms_channels_select ON public.titan_comms_channels;
CREATE POLICY titan_comms_channels_select ON public.titan_comms_channels FOR SELECT TO authenticated USING (kind='public' OR created_by_id=auth.uid() OR private.is_titan_comms_member(id) OR public.is_admin());
DROP POLICY IF EXISTS titan_comms_members_select ON public.titan_comms_members;
CREATE POLICY titan_comms_members_select ON public.titan_comms_members FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR private.is_titan_comms_creator(channel_id));
DROP POLICY IF EXISTS titan_comms_members_insert ON public.titan_comms_members;
CREATE POLICY titan_comms_members_insert ON public.titan_comms_members FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR private.is_titan_comms_creator(channel_id) OR (user_id=auth.uid() AND private.is_titan_comms_public_unprotected(channel_id)));
DROP POLICY IF EXISTS titan_comms_members_update ON public.titan_comms_members;
CREATE POLICY titan_comms_members_update ON public.titan_comms_members FOR UPDATE TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR private.is_titan_comms_creator(channel_id)) WITH CHECK (user_id=auth.uid() OR public.is_admin() OR private.is_titan_comms_creator(channel_id));
DROP POLICY IF EXISTS titan_comms_members_delete ON public.titan_comms_members;
CREATE POLICY titan_comms_members_delete ON public.titan_comms_members FOR DELETE TO authenticated USING (user_id=auth.uid() OR public.is_admin() OR private.is_titan_comms_creator(channel_id));
DROP POLICY IF EXISTS titan_comms_messages_select ON public.titan_comms_messages;
CREATE POLICY titan_comms_messages_select ON public.titan_comms_messages FOR SELECT TO authenticated USING (public.is_admin() OR private.is_titan_comms_member(channel_id) OR private.is_titan_comms_public(channel_id));
DROP POLICY IF EXISTS titan_comms_messages_insert ON public.titan_comms_messages;
CREATE POLICY titan_comms_messages_insert ON public.titan_comms_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND (public.is_admin() OR private.is_titan_comms_member(channel_id)));
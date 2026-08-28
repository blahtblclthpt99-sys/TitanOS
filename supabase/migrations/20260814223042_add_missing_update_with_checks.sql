alter policy beta_feedbacks_admin_write on public.beta_feedbacks
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter policy beta_signups_admin_write on public.beta_signups
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter policy developer_applications_admin on public.developer_applications
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter policy titan_comms_channels_update on public.titan_comms_channels
  using (
    (created_by_id = auth.uid())
    or exists (
      select 1 from public.titan_comms_members m
      where m.channel_id = titan_comms_channels.id
        and m.user_id = auth.uid()
        and m.role = any (array['owner'::text,'admin'::text])
    )
    or public.is_admin()
  )
  with check (
    (created_by_id = auth.uid())
    or exists (
      select 1 from public.titan_comms_members m
      where m.channel_id = titan_comms_channels.id
        and m.user_id = auth.uid()
        and m.role = any (array['owner'::text,'admin'::text])
    )
    or public.is_admin()
  );

alter policy titan_comms_members_update on public.titan_comms_members
  using ((user_id = auth.uid()) or public.is_admin())
  with check ((user_id = auth.uid()) or public.is_admin());

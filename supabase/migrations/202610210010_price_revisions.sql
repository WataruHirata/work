-- Bind external restore idempotency to the authoritative normal-price revision.
create function public.resolve_restore_price_quote(p_product_id uuid,p_store_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when count(distinct price_yen)=1 then jsonb_build_object('priceYen',min(price_yen),'revision',max(valid_from)) else null end
 from public.product_prices candidate
 where candidate.product_id=p_product_id and (candidate.store_id=p_store_id or candidate.store_id is null)
   and candidate.valid_from<=now() and (candidate.valid_until is null or candidate.valid_until>now())
   and candidate.valid_from=(select max(other.valid_from) from public.product_prices other where other.product_id=p_product_id and other.store_id is not distinct from candidate.store_id and other.valid_from<=now() and (other.valid_until is null or other.valid_until>now()));
$$;
revoke all on function public.resolve_restore_price_quote(uuid,uuid) from public,anon,authenticated;
grant execute on function public.resolve_restore_price_quote(uuid,uuid) to service_role;

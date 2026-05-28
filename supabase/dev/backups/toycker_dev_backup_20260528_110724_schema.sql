


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."check_is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."check_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_order_id TEXT;
  v_existing_order_id TEXT;
  v_user_id UUID;
  v_is_club_member BOOLEAN := FALSE;
  v_club_discount_percentage NUMERIC := 0;
  v_payment_discount_percentage NUMERIC := 0;
  v_payment_discount_amount NUMERIC := 0;
  v_club_savings NUMERIC := 0;
  v_promo_discount NUMERIC := 0;
  v_total_discount NUMERIC := 0;
  v_item_subtotal NUMERIC := 0;
  v_item_subtotal_before_club NUMERIC := 0;
  v_shipping_total NUMERIC := 0;
  v_tax_total NUMERIC := 0;
  v_final_total NUMERIC := 0;
  v_currency_code TEXT := 'INR';
  v_shipping_methods JSONB;
  v_payment_collection JSONB;
  v_items_json JSONB := '[]'::jsonb;
  v_gift_wrap_setting_fee NUMERIC := 0;
  v_promo_code TEXT;
  v_gift_wrap_amount NUMERIC := 0;
BEGIN
  SELECT
    user_id,
    COALESCE(currency_code, 'INR'),
    shipping_methods,
    payment_collection,
    COALESCE(discount_total, 0),
    promo_code
  INTO
    v_user_id,
    v_currency_code,
    v_shipping_methods,
    v_payment_collection,
    v_promo_discount,
    v_promo_code
  FROM public.carts
  WHERE id = p_cart_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cart not found';
  END IF;

  SELECT COALESCE(gift_wrap_fee, 0)
  INTO v_gift_wrap_setting_fee
  FROM public.global_settings
  WHERE id = 'default'
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(is_club_member, FALSE)
    INTO v_is_club_member
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_is_club_member THEN
      SELECT COALESCE(discount_percentage, 0)
      INTO v_club_discount_percentage
      FROM public.club_settings
      WHERE is_active = true
      LIMIT 1;
    END IF;
  END IF;

  SELECT COALESCE(discount_percentage, 0)
  INTO v_payment_discount_percentage
  FROM public.payment_providers
  WHERE id = p_payment_provider
    AND p_payment_provider IN ('pp_payu_payu', 'pp_easebuzz_easebuzz')
    AND is_active = true
  LIMIT 1;

  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', ci.id,
          'product_id', ci.product_id,
          'variant_id', ci.variant_id,
          'title', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN 'Gift Wrap'
            ELSE COALESCE(pv.title, p.name, 'Product')
          END,
          'product_title', COALESCE(p.name, 'Product'),
          'quantity', ci.quantity,
          'unit_price', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN ROUND(COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee), 2)
            ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100), 2)
          END,
          'original_unit_price', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN ROUND(COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee), 2)
            ELSE ROUND(COALESCE(pv.price, p.price, 0), 2)
          END,
          'total', ROUND(
            (
              CASE
                WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
                ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100), 2)
              END
            ) * ci.quantity,
            2
          ),
          'original_total', ROUND(
            (
              CASE
                WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
                ELSE COALESCE(pv.price, p.price, 0)
              END
            ) * ci.quantity,
            2
          ),
          'metadata', COALESCE(ci.metadata, '{}'::jsonb),
          'thumbnail', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN NULL
            ELSE p.image_url
          END,
          'variant', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN NULL
            WHEN pv.id IS NOT NULL THEN jsonb_build_object('title', pv.title, 'id', pv.id)
            ELSE NULL
          END,
          'created_at', ci.created_at
        )
      ),
      '[]'::jsonb
    ),
    ROUND(
      COALESCE(
        SUM(
          (
            CASE
              WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
              ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100), 2)
            END
          ) * ci.quantity
        ),
        0
      ),
      2
    ),
    ROUND(
      COALESCE(
        SUM(
          (
            CASE
              WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
              ELSE COALESCE(pv.price, p.price, 0)
            END
          ) * ci.quantity
        ),
        0
      ),
      2
    )
  INTO
    v_items_json,
    v_item_subtotal,
    v_item_subtotal_before_club
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.product_id = p.id
  LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
  WHERE ci.cart_id = p_cart_id;

  SELECT ROUND(
    COALESCE(
      SUM(
        COALESCE((metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
        * quantity
      ),
      0
    ),
    2
  )
  INTO v_gift_wrap_amount
  FROM public.cart_items
  WHERE cart_id = p_cart_id
    AND (metadata->>'gift_wrap_line')::boolean = true;

  v_club_savings := ROUND(COALESCE(v_item_subtotal_before_club - v_item_subtotal, 0), 2);

  IF v_payment_discount_percentage > 0 THEN
    v_payment_discount_amount := ROUND(
      v_item_subtotal * (v_payment_discount_percentage / 100),
      2
    );
  END IF;

  v_total_discount := ROUND(
    COALESCE(p_rewards_to_apply, 0) +
    COALESCE(v_promo_discount, 0) +
    COALESCE(v_payment_discount_amount, 0),
    2
  );

  v_shipping_total := 0;
  IF v_shipping_methods IS NOT NULL AND jsonb_array_length(v_shipping_methods) > 0 THEN
    DECLARE
      v_method JSONB := v_shipping_methods->-1;
      v_amount NUMERIC := COALESCE((v_method->>'amount')::NUMERIC, 0);
      v_threshold NUMERIC := (v_method->>'min_order_free_shipping')::NUMERIC;
    BEGIN
      IF v_threshold IS NOT NULL AND v_item_subtotal >= v_threshold THEN
        v_shipping_total := 0;
      ELSE
        v_shipping_total := ROUND(v_amount, 2);
      END IF;
    END;
  END IF;

  v_final_total := ROUND(
    GREATEST(
      0,
      v_item_subtotal +
      COALESCE(v_tax_total, 0) +
      v_shipping_total -
      v_total_discount
    ),
    2
  );

  UPDATE public.carts
  SET
    email = p_email,
    shipping_address = p_shipping_address,
    billing_address = p_billing_address,
    metadata =
      COALESCE(metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'rewards_to_apply',
        COALESCE(p_rewards_to_apply, 0)
      ),
    updated_at = NOW()
  WHERE id = p_cart_id;

  SELECT id
  INTO v_existing_order_id
  FROM public.orders
  WHERE metadata->>'cart_id' = p_cart_id
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_order_id IS NOT NULL THEN
    UPDATE public.orders
    SET
      email = p_email,
      customer_email = p_email,
      shipping_address = p_shipping_address,
      billing_address = p_billing_address,
      subtotal = v_item_subtotal,
      tax_total = v_tax_total,
      shipping_total = v_shipping_total,
      discount_total = v_total_discount,
      total_amount = v_final_total,
      total = v_final_total,
      currency_code = v_currency_code,
      payment_collection = v_payment_collection,
      items = v_items_json,
      shipping_methods = v_shipping_methods,
      promo_code = v_promo_code,
      payment_method = p_payment_provider,
      metadata = jsonb_build_object(
        'cart_id', p_cart_id,
        'rewards_used', COALESCE(p_rewards_to_apply, 0),
        'rewards_discount', COALESCE(p_rewards_to_apply, 0),
        'payment_discount_amount', COALESCE(v_payment_discount_amount, 0),
        'payment_discount_percentage', COALESCE(v_payment_discount_percentage, 0),
        'promo_discount', COALESCE(v_promo_discount, 0),
        'promo_code', v_promo_code,
        'club_savings', COALESCE(v_club_savings, 0),
        'club_discount_percentage', COALESCE(v_club_discount_percentage, 0),
        'is_club_member', v_is_club_member,
        'gift_wrap_amount', v_gift_wrap_amount
      ),
      updated_at = NOW()
    WHERE id = v_existing_order_id;

    v_order_id := v_existing_order_id;
  ELSE
    INSERT INTO public.orders (
      user_id,
      email,
      customer_email,
      shipping_address,
      billing_address,
      subtotal,
      tax_total,
      shipping_total,
      discount_total,
      total_amount,
      total,
      currency_code,
      payment_collection,
      items,
      shipping_methods,
      metadata,
      promo_code,
      payment_method,
      status,
      payment_status,
      fulfillment_status,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      p_email,
      p_email,
      p_shipping_address,
      p_billing_address,
      v_item_subtotal,
      v_tax_total,
      v_shipping_total,
      v_total_discount,
      v_final_total,
      v_final_total,
      v_currency_code,
      v_payment_collection,
      v_items_json,
      v_shipping_methods,
      jsonb_build_object(
        'cart_id', p_cart_id,
        'rewards_used', COALESCE(p_rewards_to_apply, 0),
        'rewards_discount', COALESCE(p_rewards_to_apply, 0),
        'payment_discount_amount', COALESCE(v_payment_discount_amount, 0),
        'payment_discount_percentage', COALESCE(v_payment_discount_percentage, 0),
        'promo_discount', COALESCE(v_promo_discount, 0),
        'promo_code', v_promo_code,
        'club_savings', COALESCE(v_club_savings, 0),
        'club_discount_percentage', COALESCE(v_club_discount_percentage, 0),
        'is_club_member', v_is_club_member,
        'gift_wrap_amount', v_gift_wrap_amount
      ),
      v_promo_code,
      p_payment_provider,
      'pending',
      'pending',
      'not_shipped',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id
  );
END;
$$;


ALTER FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[] DEFAULT NULL::"text"[], "p_collection_ids" "text"[] DEFAULT NULL::"text"[], "p_product_ids" "text"[] DEFAULT NULL::"text"[], "p_search_query" "text" DEFAULT NULL::"text", "p_availability" "text" DEFAULT NULL::"text") RETURNS TABLE("min_price" numeric, "max_price" numeric)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH product_prices AS (
    SELECT
      COALESCE(
        (
          SELECT min(v.price)
          FROM public.product_variants v
          WHERE v.product_id = p.id
        ),
        p.price
      ) AS display_price
    FROM public.products p
    WHERE p.status = 'active'
      AND (
        p_product_ids IS NULL
        OR cardinality(p_product_ids) = 0
        OR p.id = ANY(p_product_ids)
      )
      AND (
        p_category_ids IS NULL
        OR cardinality(p_category_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_categories pc
          WHERE pc.product_id = p.id
            AND pc.category_id = ANY(p_category_ids)
        )
      )
      AND (
        p_collection_ids IS NULL
        OR cardinality(p_collection_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_collections pcl
          WHERE pcl.product_id = p.id
            AND pcl.collection_id = ANY(p_collection_ids)
        )
      )
      AND (
        p_search_query IS NULL
        OR p.name ILIKE ('%' || p_search_query || '%')
      )
      AND (
        p_availability IS NULL
        OR (p_availability = 'in_stock' AND p.stock_count > 0)
        OR (p_availability = 'out_of_stock' AND p.stock_count = 0)
      )
  )
  SELECT
    min(display_price) AS min_price,
    max(display_price) AS max_price
  FROM product_prices
  WHERE display_price <> 0;
$$;


ALTER FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text") IS 'Returns variant-aware storefront price slider bounds for the current non-price product filters.';



CREATE OR REPLACE FUNCTION "public"."handle_admin_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    notify_title TEXT;
    notify_message TEXT;
    notify_type TEXT;
    notify_metadata JSONB;
BEGIN
    -- Handle Orders
    IF TG_TABLE_NAME = 'orders' THEN
        notify_type := 'order';
        notify_title := 'New Order Placed';
        notify_message := 'Order #' || COALESCE(NEW.display_id::text, 'NEW') || ' received from ' || COALESCE(NEW.customer_email, NEW.email, 'guest');
        notify_metadata := jsonb_build_object(
            'order_id', NEW.id, 
            'display_id', NEW.display_id,
            'total', NEW.total
        );
    
    -- Handle User Signups
    ELSIF TG_TABLE_NAME = 'profiles' THEN
        IF TG_OP = 'INSERT' THEN
            notify_type := 'user';
            notify_title := 'New User Registered';
            notify_message := COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') || ' (' || COALESCE(NEW.email, 'no email') || ') joined Toycker.';
            notify_metadata := jsonb_build_object('user_id', NEW.id, 'email', NEW.email);
        ELSE
            RETURN NEW; 
        END IF;

    -- Handle Reviews
    ELSIF TG_TABLE_NAME = 'reviews' THEN
        notify_type := 'review';
        notify_title := 'New Review Submitted';
        notify_message := 'New ' || COALESCE(NEW.rating::text, '?') || '-star review from ' || COALESCE(NEW.display_name, 'Anonymous');
        notify_metadata := jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id, 'rating', NEW.rating);
    
    -- Fallback
    ELSE
        notify_type := 'system';
        notify_title := 'System Event (' || TG_TABLE_NAME || ')';
        notify_message := 'Event ' || TG_OP || ' occurred on ' || TG_TABLE_NAME;
        notify_metadata := '{}'::jsonb;
    END IF;

    -- Safety check for NULL type
    IF notify_type IS NULL THEN
        notify_type := 'system';
        notify_title := 'Unknown Event';
        notify_message := 'An unknown event occurred (Type was NULL)';
        notify_metadata := jsonb_build_object('table', TG_TABLE_NAME, 'op', TG_OP);
    END IF;

    -- Insert
    INSERT INTO public.admin_notifications (type, title, message, metadata, created_at)
    VALUES (notify_type, notify_title, notify_message, notify_metadata, NOW());

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_admin_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ BEGIN INSERT INTO public.profiles (id, email, first_name, last_name, phone, created_at, updated_at) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''), COALESCE(NULLIF(NEW.phone, ''), NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', ''), NOW(), NOW()) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
UPDATE public.profiles
SET
first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', first_name),
last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', last_name),
phone = COALESCE(NULLIF(NEW.phone, ''), NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', phone),
updated_at = NOW()
WHERE id = NEW.id;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("required_permission" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_permissions_jsonb JSONB;
  user_permissions TEXT[];
  category TEXT;
  category_wildcard TEXT;
BEGIN
  -- Get current user's permissions from their assigned role (as jsonb)
  SELECT ar.permissions INTO user_permissions_jsonb
  FROM profiles p
  INNER JOIN admin_roles ar ON p.admin_role_id = ar.id
  WHERE p.id = auth.uid();

  -- If user has no role assigned, deny access
  IF user_permissions_jsonb IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Convert jsonb array to text array for easier checking
  user_permissions := ARRAY(
    SELECT jsonb_array_elements_text(user_permissions_jsonb)
  );

  -- If permissions array is empty, deny access
  IF array_length(user_permissions, 1) IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check for full access wildcard (Owner role)
  IF '*' = ANY(user_permissions) THEN
    RETURN TRUE;
  END IF;

  -- Check for exact permission match
  IF required_permission = ANY(user_permissions) THEN
    RETURN TRUE;
  END IF;

  -- Extract category from permission (e.g., 'orders' from 'orders:read')
  category := split_part(required_permission, ':', 1);
  category_wildcard := category || ':*';
  
  -- Check for category wildcard match (e.g., 'orders:*' matches 'orders:read')
  IF category_wildcard = ANY(user_permissions) THEN
    RETURN TRUE;
  END IF;

  -- No permission found, deny access
  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."has_permission"("required_permission" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_permission"("required_permission" "text") IS 'Checks if the current authenticated user has the specified permission. 
   Supports wildcards: "*" for full access and "resource:*" for category access.
   Returns FALSE if user has no role assigned.';



CREATE OR REPLACE FUNCTION "public"."increment_promotion_uses"("promo_id" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
    UPDATE promotions
    SET used_count = used_count + 1
    WHERE id = promo_id;
END;
$$;


ALTER FUNCTION "public"."increment_promotion_uses"("promo_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    user_role TEXT;
    user_admin_role_id TEXT;
BEGIN
    -- Check profiles table using 'id' (correct PK)
    -- We select into variables to be safe
    SELECT role, admin_role_id INTO user_role, user_admin_role_id
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN (user_role = 'admin') OR (user_admin_role_id IS NOT NULL);
END;
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric DEFAULT NULL::numeric, "p_max_price" numeric DEFAULT NULL::numeric, "p_category_ids" "text"[] DEFAULT NULL::"text"[], "p_collection_ids" "text"[] DEFAULT NULL::"text"[], "p_product_ids" "text"[] DEFAULT NULL::"text"[], "p_search_query" "text" DEFAULT NULL::"text", "p_availability" "text" DEFAULT NULL::"text", "p_sort_by" "text" DEFAULT 'featured'::"text", "p_offset" integer DEFAULT 0, "p_limit" integer DEFAULT 12) RETURNS TABLE("id" "text", "handle" "text", "name" "text", "short_description" "text", "price" numeric, "currency_code" "text", "image_url" "text", "thumbnail" "text", "stock_count" integer, "metadata" "jsonb", "category_id" "text", "collection_id" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "status" "text", "variants" "jsonb", "display_price" numeric, "total_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  WITH product_prices AS (
    SELECT
      p.id,
      p.handle,
      p.name,
      p.short_description,
      p.price,
      p.currency_code,
      p.image_url,
      p.thumbnail,
      p.stock_count,
      p.metadata,
      p.category_id,
      p.collection_id,
      p.created_at,
      p.updated_at,
      p.status,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', v.id,
              'title', v.title,
              'price', v.price,
              'compare_at_price', v.compare_at_price,
              'inventory_quantity', v.inventory_quantity,
              'manage_inventory', v.manage_inventory,
              'allow_backorder', v.allow_backorder,
              'product_id', v.product_id,
              'image_url', v.image_url,
              'options', v.options
            )
            ORDER BY v.price ASC, v.created_at ASC
          )
          FROM public.product_variants v
          WHERE v.product_id = p.id
        ),
        '[]'::jsonb
      ) AS variants,
      COALESCE(
        (
          SELECT min(v.price)
          FROM public.product_variants v
          WHERE v.product_id = p.id
        ),
        p.price
      ) AS display_price
    FROM public.products p
    WHERE p.status = 'active'
      AND (
        p_product_ids IS NULL
        OR cardinality(p_product_ids) = 0
        OR p.id = ANY(p_product_ids)
      )
      AND (
        p_category_ids IS NULL
        OR cardinality(p_category_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_categories pc
          WHERE pc.product_id = p.id
            AND pc.category_id = ANY(p_category_ids)
        )
      )
      AND (
        p_collection_ids IS NULL
        OR cardinality(p_collection_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_collections pcl
          WHERE pcl.product_id = p.id
            AND pcl.collection_id = ANY(p_collection_ids)
        )
      )
      AND (
        p_search_query IS NULL
        OR p.name ILIKE ('%' || p_search_query || '%')
      )
      AND (
        p_availability IS NULL
        OR (p_availability = 'in_stock' AND p.stock_count > 0)
        OR (p_availability = 'out_of_stock' AND p.stock_count = 0)
      )
  ),
  filtered AS (
    SELECT *
    FROM product_prices
    WHERE display_price <> 0
      AND (p_min_price IS NULL OR display_price >= p_min_price)
      AND (p_max_price IS NULL OR display_price <= p_max_price)
  ),
  counted AS (
    SELECT
      filtered.*,
      count(*) OVER () AS total_count
    FROM filtered
  )
  SELECT
    counted.id,
    counted.handle,
    counted.name,
    counted.short_description,
    counted.price,
    counted.currency_code,
    counted.image_url,
    counted.thumbnail,
    counted.stock_count,
    counted.metadata,
    counted.category_id,
    counted.collection_id,
    counted.created_at,
    counted.updated_at,
    counted.status,
    counted.variants,
    counted.display_price,
    counted.total_count
  FROM counted
  ORDER BY
    CASE WHEN p_sort_by = 'price_asc' THEN counted.display_price END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'price_desc' THEN counted.display_price END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'alpha_asc' THEN counted.name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'alpha_desc' THEN counted.name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'date_old_new' THEN counted.created_at END ASC NULLS LAST,
    CASE WHEN p_sort_by IN ('date_new_old', 'featured', 'best_selling') OR p_sort_by IS NULL THEN counted.created_at END DESC NULLS LAST,
    counted.created_at DESC,
    counted.id ASC
  OFFSET GREATEST(p_offset, 0)
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;


ALTER FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric, "p_max_price" numeric, "p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text", "p_sort_by" "text", "p_offset" integer, "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric, "p_max_price" numeric, "p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text", "p_sort_by" "text", "p_offset" integer, "p_limit" integer) IS 'Storefront product listing helper that applies variant-aware price filtering, sorting, and pagination in SQL.';



CREATE OR REPLACE FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) RETURNS TABLE("id" "uuid", "title" "text", "handle" "text", "thumbnail" "text", "similarity" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    public.products.id,
    public.products.title,
    public.products.handle,
    public.products.thumbnail,
    1 - (public.products.embedding <=> query_embedding) as similarity
  FROM public.products
  WHERE public.products.embedding IS NOT NULL
    AND 1 - (public.products.embedding <=> query_embedding) > match_threshold
  ORDER BY public.products.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "text" DEFAULT ('cat_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "name" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "image_url" "text",
    "parent_category_id" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."parent_category"("public"."categories") RETURNS SETOF "public"."categories"
    LANGUAGE "sql" STABLE ROWS 1
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $_$
  SELECT * FROM categories WHERE id = $1.parent_category_id
$_$;


ALTER FUNCTION "public"."parent_category"("public"."categories") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Validate that all provided IDs exist
  IF array_length(collection_ids, 1) != (
    SELECT COUNT(*) 
    FROM public.home_exclusive_collections 
    WHERE id = ANY(collection_ids)
  ) THEN
    RAISE EXCEPTION 'Invalid collection IDs provided';
  END IF;
  
  -- Update sort_order for each collection atomically
  FOR i IN 1..array_length(collection_ids, 1) LOOP
    UPDATE public.home_exclusive_collections
    SET 
      sort_order = i - 1,
      updated_at = now()
    WHERE id = collection_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  i INTEGER;
BEGIN
  -- Check if user is admin
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;
  
  -- Validate that all provided IDs exist
  IF array_length(banner_ids, 1) != (
    SELECT COUNT(*) 
    FROM public.home_banners 
    WHERE id = ANY(banner_ids)
  ) THEN
    RAISE EXCEPTION 'Invalid banner IDs provided';
  END IF;
  
  -- Update sort_order for each banner atomically
  FOR i IN 1..array_length(banner_ids, 1) LOOP
    UPDATE public.home_banners
    SET 
      sort_order = i - 1,
      updated_at = now()
    WHERE id = banner_ids[i];
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision DEFAULT 0.15, "result_limit" integer DEFAULT 20) RETURNS TABLE("id" "text", "name" "text", "handle" "text", "image_url" "text", "thumbnail" "text", "price" numeric, "currency_code" "text", "relevance_score" double precision)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  WITH combined_results AS (
    -- Full Text Search Ranking
    SELECT 
      p.id, p.name, p.handle, p.image_url, p.thumbnail, 
      COALESCE((SELECT min(v.price) FROM public.product_variants v WHERE v.product_id = p.id), p.price) as effective_price,
      p.currency_code,
      ts_rank_cd(p.search_vector, websearch_to_tsquery('english', search_query)) * 0.7 AS score
    FROM public.products p
    WHERE p.search_vector @@ websearch_to_tsquery('english', search_query)
    
    UNION ALL

    -- Trigram Similarity (Fuzzy matching)
    SELECT 
      p.id, p.name, p.handle, p.image_url, p.thumbnail,
      COALESCE((SELECT min(v.price) FROM public.product_variants v WHERE v.product_id = p.id), p.price) as effective_price,
      p.currency_code,
      similarity(p.name, search_query) * 0.3 AS score
    FROM public.products p
    WHERE p.name % search_query

    UNION ALL

    -- Prefix Match Fallback (Important for auto-complete feel)
    SELECT 
      p.id, p.name, p.handle, p.image_url, p.thumbnail,
      COALESCE((SELECT min(v.price) FROM public.product_variants v WHERE v.product_id = p.id), p.price) as effective_price,
      p.currency_code,
      0.1 AS score
    FROM public.products p
    WHERE p.name ILIKE search_query || '%'
  ),
  aggregated AS (
    SELECT 
      r.id, r.name, r.handle, r.image_url, r.thumbnail, r.effective_price, r.currency_code,
      SUM(r.score) as combined_score
    FROM combined_results r
    GROUP BY r.id, r.name, r.handle, r.image_url, r.thumbnail, r.effective_price, r.currency_code
  )
  SELECT 
    a.id, a.name, a.handle, a.image_url, a.thumbnail, 
    a.effective_price::DECIMAL, a.currency_code,
    a.combined_score::FLOAT as relevance_score
  FROM aggregated a
  ORDER BY combined_score DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_products_multimodal"("search_query" "text" DEFAULT NULL::"text", "search_embedding" "extensions"."vector" DEFAULT NULL::"extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 20) RETURNS TABLE("id" "text", "name" "text", "handle" "text", "image_url" "text", "thumbnail" "text", "price" numeric, "currency_code" "text", "stock_count" integer, "relevance_score" double precision)
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
  RETURN QUERY
  WITH text_scores AS (
    SELECT
      p.id::TEXT as product_id,
      GREATEST(
        CASE
          WHEN search_query IS NOT NULL AND p.search_vector @@ websearch_to_tsquery('english', search_query)
          THEN ts_rank_cd(p.search_vector, websearch_to_tsquery('english', search_query)) * 0.5
          ELSE 0
        END,
        CASE
          WHEN search_query IS NOT NULL THEN similarity(p.name, search_query) * 0.4
          ELSE 0
        END,
        CASE
          WHEN search_query IS NOT NULL AND p.name ILIKE search_query || '%' THEN 0.1
          ELSE 0
        END
      ) as text_score
    FROM public.products p
    WHERE search_query IS NOT NULL
      AND p.status = 'active'
  ),
  image_scores AS (
    SELECT
      p.id::TEXT as product_id,
      1 - (p.image_embedding <=> search_embedding) as image_score
    FROM public.products p
    WHERE search_embedding IS NOT NULL
      AND p.image_embedding IS NOT NULL
      AND p.status = 'active'
  ),
  combined_scores AS (
    SELECT
      COALESCE(t.product_id, i.product_id) as product_id,
      CASE
        WHEN t.text_score > 0 AND i.image_score IS NOT NULL
          THEN (t.text_score * 0.4 + i.image_score * 0.6)
        WHEN t.text_score > 0
          THEN t.text_score
        WHEN i.image_score IS NOT NULL
          THEN i.image_score
        ELSE 0
      END as final_score
    FROM text_scores t
    FULL OUTER JOIN image_scores i ON t.product_id = i.product_id
  )
  SELECT
    p.id::TEXT,
    p.name,
    p.handle,
    p.image_url,
    p.thumbnail,
    COALESCE(
      (SELECT min(v.price) FROM public.product_variants v WHERE v.product_id = p.id),
      p.price
    )::DECIMAL as price,
    p.currency_code,
    p.stock_count,
    c.final_score::FLOAT as relevance_score
  FROM combined_scores c
  JOIN public.products p ON c.product_id = p.id::TEXT
  WHERE c.final_score >= match_threshold
    AND p.status = 'active'
  ORDER BY c.final_score DESC
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) IS 'Hybrid search combining text and image embeddings for active storefront products only. Includes stock_count for lightweight result cards. Last updated 2026-05-06.';



CREATE OR REPLACE FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text" DEFAULT NULL::"text", "p_session_id" "text" DEFAULT NULL::"text", "p_duration_ms" integer DEFAULT NULL::integer) RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.search_analytics (
    search_query, search_type, results_count, 
    user_id, session_id, search_duration_ms
  )
  VALUES (
    p_query, p_type, p_results_count,
    p_user_id, p_session_id, p_duration_ms
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trivara_order_bookings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_trivara_order_bookings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_trivara_sync_snapshots_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_trivara_sync_snapshots_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "text" DEFAULT ('ord_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "display_id" integer NOT NULL,
    "customer_email" "text" NOT NULL,
    "user_id" "uuid",
    "total_amount" numeric NOT NULL,
    "currency_code" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text",
    "payment_status" "text" DEFAULT 'awaiting'::"text",
    "fulfillment_status" "text" DEFAULT 'not_shipped'::"text",
    "payu_txn_id" "text",
    "shipping_address" "jsonb",
    "billing_address" "jsonb",
    "items" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "shipping_methods" "jsonb",
    "email" "text",
    "total" numeric DEFAULT 0,
    "subtotal" numeric DEFAULT 0,
    "tax_total" numeric DEFAULT 0,
    "shipping_total" numeric DEFAULT 0,
    "discount_total" numeric DEFAULT 0,
    "gift_card_total" numeric DEFAULT 0,
    "shipping_partner_id" "text",
    "tracking_number" "text",
    "payment_method" "text",
    "promo_code" "text",
    "payment_collection" "jsonb",
    "gateway_txn_id" "text"
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."account_order_summaries" WITH ("security_invoker"='true') AS
 SELECT "id",
    "user_id",
    "display_id",
    "created_at",
    "status",
    "fulfillment_status",
    "payment_status",
    "total",
    "total_amount",
    "currency_code",
    COALESCE(NULLIF((("items" -> 0) ->> 'product_title'::"text"), ''::"text"), NULLIF((("items" -> 0) ->> 'title'::"text"), ''::"text"), 'Order items'::"text") AS "first_item_title",
    NULLIF((("items" -> 0) ->> 'thumbnail'::"text"), ''::"text") AS "first_item_thumbnail",
        CASE
            WHEN ("jsonb_typeof"("items") = 'array'::"text") THEN "jsonb_array_length"("items")
            ELSE 0
        END AS "item_count"
   FROM "public"."orders" "o";


ALTER VIEW "public"."account_order_summaries" OWNER TO "postgres";


COMMENT ON VIEW "public"."account_order_summaries" IS 'Lightweight customer account order list projection. Uses security_invoker so existing orders RLS is respected.';



CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "company" "text",
    "address_1" "text",
    "address_2" "text",
    "city" "text",
    "country_code" "text",
    "province" "text",
    "postal_code" "text",
    "phone" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_default_billing" boolean DEFAULT false,
    "is_default_shipping" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_notifications_type_check" CHECK (("type" = ANY (ARRAY['order'::"text", 'user'::"text", 'review'::"text", 'system'::"text", 'alert'::"text"])))
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "id" "text" DEFAULT ('role_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cart_items" (
    "id" "text" DEFAULT ('item_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "cart_id" "text" NOT NULL,
    "product_id" "text" NOT NULL,
    "variant_id" "text",
    "quantity" integer DEFAULT 1 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cart_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carts" (
    "id" "text" DEFAULT ('cart_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "email" "text",
    "user_id" "uuid",
    "region_id" "text",
    "currency_code" "text" DEFAULT 'INR'::"text",
    "shipping_address" "jsonb",
    "billing_address" "jsonb",
    "shipping_methods" "jsonb",
    "payment_collection" "jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "promo_code" "text",
    "discount_total" numeric DEFAULT 0
);


ALTER TABLE "public"."carts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."club_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "min_purchase_amount" numeric DEFAULT 999 NOT NULL,
    "discount_percentage" integer DEFAULT 10 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "rewards_percentage" integer DEFAULT 5 NOT NULL
);


ALTER TABLE "public"."club_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "text" DEFAULT ('col_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "title" "text" NOT NULL,
    "handle" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "image_url" "text"
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customer_display_id_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_display_id_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "gift_wrap_fee" numeric DEFAULT 50 NOT NULL,
    "is_gift_wrap_enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";


COMMENT ON TABLE "public"."global_settings" IS 'Global application settings. RLS enabled - public read, admin write.';



CREATE TABLE IF NOT EXISTS "public"."home_banners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "image_url" "text" NOT NULL,
    "alt_text" "text",
    "link_url" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."home_banners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_exclusive_collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text" NOT NULL,
    "video_url" "text" NOT NULL,
    "poster_url" "text",
    "video_duration" integer,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."home_exclusive_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."home_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."home_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image" (
    "id" "text" DEFAULT ('img_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "url" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_timeline" (
    "id" "text" DEFAULT ('evt_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "order_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "actor" "text" DEFAULT 'system'::"text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_timeline_event_type_check" CHECK (("event_type" = ANY (ARRAY['order_placed'::"text", 'payment_pending'::"text", 'payment_captured'::"text", 'payment_failed'::"text", 'processing'::"text", 'shipped'::"text", 'out_for_delivery'::"text", 'delivered'::"text", 'cancelled'::"text", 'refunded'::"text", 'note_added'::"text"])))
);


ALTER TABLE "public"."order_timeline" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."orders_display_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_display_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."orders_display_id_seq" OWNED BY "public"."orders"."display_id";



CREATE TABLE IF NOT EXISTS "public"."otp_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "phone" "text" NOT NULL,
    "code" "text",
    "expires_at" timestamp with time zone NOT NULL,
    "verified" boolean DEFAULT false,
    "attempts" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "code_hash" "text",
    "delivery_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "provider_message_id" "text",
    "consumed_at" timestamp with time zone,
    CONSTRAINT "otp_codes_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."otp_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_providers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "discount_percentage" numeric DEFAULT 0,
    "partial_payment_percentage" numeric
);


ALTER TABLE "public"."payment_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "product_id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_collections" (
    "id" "text" DEFAULT ('pc_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "product_id" "text" NOT NULL,
    "collection_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_combinations" (
    "id" "text" DEFAULT ('comb_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "product_id" "text" NOT NULL,
    "related_product_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_combinations" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_combinations" IS 'Stores manually selected product relationships for "Frequently Bought Together" feature.';



CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "product_id" "text" NOT NULL,
    "image_id" "text" NOT NULL
);


ALTER TABLE "public"."product_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_option_values" (
    "id" "text" DEFAULT ('optval_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "value" "text" NOT NULL,
    "option_id" "text",
    "variant_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_option_values" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_option_values" IS 'Stores values for product options and links to variants';



CREATE TABLE IF NOT EXISTS "public"."product_options" (
    "id" "text" DEFAULT ('opt_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "title" "text" NOT NULL,
    "product_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_options" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_options" IS 'Stores product options like Color, Size, etc.';



CREATE TABLE IF NOT EXISTS "public"."product_variants" (
    "id" "text" DEFAULT ('var_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "title" "text" DEFAULT 'Default Variant'::"text" NOT NULL,
    "sku" "text",
    "barcode" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "inventory_quantity" integer DEFAULT 100,
    "manage_inventory" boolean DEFAULT true,
    "allow_backorder" boolean DEFAULT false,
    "product_id" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "original_price" numeric,
    "compare_at_price" numeric,
    "image_url" "text"
);


ALTER TABLE "public"."product_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "text" DEFAULT ('prod_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "handle" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "price" numeric DEFAULT 0 NOT NULL,
    "image_url" "text",
    "stock_count" integer DEFAULT 0,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "category_id" "text",
    "collection_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "thumbnail" "text",
    "images" "text"[],
    "currency_code" "text" DEFAULT 'inr'::"text",
    "subtitle" "text",
    "short_description" "text",
    "video_url" "text",
    "search_vector" "tsvector" GENERATED ALWAYS AS (("setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("name", ''::"text")), 'A'::"char") || "setweight"("to_tsvector"('"english"'::"regconfig", COALESCE("description", ''::"text")), 'B'::"char"))) STORED,
    "image_embedding" "extensions"."vector"(512),
    "seo_title" "text",
    "seo_description" "text",
    "seo_metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."products"."image_embedding" IS '512-dimensional CLIP ViT-B-32 image embedding for visual similarity search. 
Generated using Transformers.js CLIP model. Must be L2-normalized before storage.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "role" "text" DEFAULT 'customer'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "customer_display_id" integer DEFAULT "nextval"('"public"."customer_display_id_seq"'::"regclass"),
    "is_club_member" boolean DEFAULT false,
    "club_member_since" timestamp with time zone,
    "total_club_savings" numeric DEFAULT 0,
    "admin_role_id" "text",
    "phone" "text",
    "contact_email" "text",
    "club_membership_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "club_qualifying_order_id" "text",
    "club_revocation_reason" "text",
    CONSTRAINT "profiles_club_membership_status_check" CHECK (("club_membership_status" = ANY (ARRAY['none'::"text", 'pending_eligible'::"text", 'active'::"text", 'revoked'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."promotions" (
    "id" "text" DEFAULT ('prom_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "code" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" numeric DEFAULT 0 NOT NULL,
    "min_order_amount" numeric DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "starts_at" timestamp with time zone DEFAULT "now"(),
    "ends_at" timestamp with time zone,
    "max_uses" integer,
    "used_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_deleted" boolean DEFAULT false,
    CONSTRAINT "promotions_type_check" CHECK (("type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text", 'free_shipping'::"text"])))
);


ALTER TABLE "public"."promotions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_media" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid",
    "file_path" "text" NOT NULL,
    "file_type" "text",
    "storage_provider" "text" DEFAULT 'r2'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "review_media_file_type_check" CHECK (("file_type" = ANY (ARRAY['image'::"text", 'video'::"text", 'audio'::"text"])))
);


ALTER TABLE "public"."review_media" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" "text" NOT NULL,
    "user_id" "uuid",
    "rating" integer NOT NULL,
    "title" "text",
    "content" "text",
    "approval_status" "text" DEFAULT 'pending'::"text",
    "is_anonymous" boolean DEFAULT false,
    "display_name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "wallet_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "order_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reward_transactions_type_check" CHECK (("type" = ANY (ARRAY['earned'::"text", 'spent'::"text"])))
);


ALTER TABLE "public"."reward_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reward_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reward_wallets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."search_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "search_query" "text" NOT NULL,
    "search_type" "text" NOT NULL,
    "results_count" integer NOT NULL,
    "user_id" "text",
    "session_id" "text",
    "search_duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."search_analytics" OWNER TO "postgres";


COMMENT ON TABLE "public"."search_analytics" IS 'Search analytics with session tracking. RLS enabled - public insert, admin read only.';



CREATE TABLE IF NOT EXISTS "public"."shipping_options" (
    "id" "text" DEFAULT ('so_'::"text" || "substr"("md5"(("random"())::"text"), 1, 10)) NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "min_order_free_shipping" numeric(10,2) DEFAULT NULL::numeric
);


ALTER TABLE "public"."shipping_options" OWNER TO "postgres";


COMMENT ON COLUMN "public"."shipping_options"."min_order_free_shipping" IS 'Order subtotal threshold above which shipping is free. NULL means never free (unless covered by other rules).';



CREATE TABLE IF NOT EXISTS "public"."shipping_partners" (
    "id" "text" DEFAULT ('sp_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_partners" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trivara_order_bookings" (
    "id" "text" DEFAULT ('tob_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "order_id" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "trivara_reference_number" "text",
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_payload" "jsonb",
    "error_message" "text",
    "tracking_status" "text",
    "tracking_payload" "jsonb",
    "tracking_synced_at" timestamp with time zone,
    "print_slip_payload" "jsonb",
    "print_slip_synced_at" timestamp with time zone,
    "cancel_payload" "jsonb",
    "cancel_error_message" "text",
    "cancelled_at" timestamp with time zone,
    "booked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "trivara_order_bookings_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'booked'::"text", 'failed'::"text", 'skipped'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."trivara_order_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trivara_sync_snapshots" (
    "sync_key" "text" NOT NULL,
    "request_payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "response_payload" "jsonb",
    "error_message" "text",
    "synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."trivara_sync_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wishlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wishlist_items" OWNER TO "postgres";


ALTER TABLE ONLY "public"."orders" ALTER COLUMN "display_id" SET DEFAULT "nextval"('"public"."orders_display_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."club_settings"
    ADD CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_product_id_key" UNIQUE ("product_id");



ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_review_id_key" UNIQUE ("review_id");



ALTER TABLE ONLY "public"."image"
    ADD CONSTRAINT "image_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_timeline"
    ADD CONSTRAINT "order_timeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_providers"
    ADD CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id", "category_id");



ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_product_id_collection_id_key" UNIQUE ("product_id", "collection_id");



ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_product_id_related_product_id_key" UNIQUE ("product_id", "related_product_id");



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id", "image_id");



ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_handle_key" UNIQUE ("handle");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_options"
    ADD CONSTRAINT "shipping_options_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trivara_order_bookings"
    ADD CONSTRAINT "trivara_order_bookings_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."trivara_order_bookings"
    ADD CONSTRAINT "trivara_order_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trivara_sync_snapshots"
    ADD CONSTRAINT "trivara_sync_snapshots_pkey" PRIMARY KEY ("sync_key");



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_product_id_key" UNIQUE ("user_id", "product_id");



CREATE INDEX "idx_addresses_user_id" ON "public"."addresses" USING "btree" ("user_id");



CREATE INDEX "idx_admin_roles_id" ON "public"."admin_roles" USING "btree" ("id");



CREATE INDEX "idx_admin_roles_permissions" ON "public"."admin_roles" USING "gin" ("permissions");



CREATE INDEX "idx_cart_items_cart_id" ON "public"."cart_items" USING "btree" ("cart_id");



CREATE INDEX "idx_cart_items_product_id" ON "public"."cart_items" USING "btree" ("product_id");



CREATE INDEX "idx_cart_items_variant_id" ON "public"."cart_items" USING "btree" ("variant_id");



CREATE INDEX "idx_carts_user_id" ON "public"."carts" USING "btree" ("user_id");



CREATE INDEX "idx_exclusive_collections_active_sort" ON "public"."home_exclusive_collections" USING "btree" ("is_active", "sort_order") WHERE ("is_active" = true);



CREATE INDEX "idx_home_banners_active_sort" ON "public"."home_banners" USING "btree" ("is_active", "sort_order") WHERE ("is_active" = true);



CREATE INDEX "idx_home_banners_schedule" ON "public"."home_banners" USING "btree" ("starts_at", "ends_at") WHERE ("is_active" = true);



CREATE INDEX "idx_order_timeline_created_at" ON "public"."order_timeline" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_order_timeline_order_id" ON "public"."order_timeline" USING "btree" ("order_id");



CREATE UNIQUE INDEX "idx_orders_pending_cart_id" ON "public"."orders" USING "btree" ((("metadata" ->> 'cart_id'::"text"))) WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_orders_shipping_partner_id" ON "public"."orders" USING "btree" ("shipping_partner_id");



CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_otp_codes_delivery_status" ON "public"."otp_codes" USING "btree" ("delivery_status");



CREATE INDEX "idx_otp_codes_expires_at" ON "public"."otp_codes" USING "btree" ("expires_at");



CREATE INDEX "idx_otp_codes_phone" ON "public"."otp_codes" USING "btree" ("phone");



CREATE INDEX "idx_otp_codes_phone_active" ON "public"."otp_codes" USING "btree" ("phone", "created_at" DESC) WHERE ("verified" = false);



CREATE INDEX "idx_product_categories_category_id" ON "public"."product_categories" USING "btree" ("category_id");



CREATE INDEX "idx_product_collections_collection_id" ON "public"."product_collections" USING "btree" ("collection_id");



CREATE INDEX "idx_product_images_image_id" ON "public"."product_images" USING "btree" ("image_id");



CREATE INDEX "idx_product_option_values_option_id" ON "public"."product_option_values" USING "btree" ("option_id");



CREATE INDEX "idx_product_option_values_variant_id" ON "public"."product_option_values" USING "btree" ("variant_id");



CREATE INDEX "idx_product_options_product_id" ON "public"."product_options" USING "btree" ("product_id");



CREATE INDEX "idx_product_variants_compare_at_price" ON "public"."product_variants" USING "btree" ("compare_at_price");



CREATE INDEX "idx_product_variants_product_id" ON "public"."product_variants" USING "btree" ("product_id");



CREATE INDEX "idx_product_variants_product_id_price" ON "public"."product_variants" USING "btree" ("product_id", "price");



CREATE INDEX "idx_products_collection_id" ON "public"."products" USING "btree" ("collection_id");



CREATE INDEX "idx_products_seo_metadata_gin" ON "public"."products" USING "gin" ("seo_metadata");



CREATE INDEX "idx_profiles_admin_role_id" ON "public"."profiles" USING "btree" ("admin_role_id");



CREATE INDEX "idx_profiles_club_qualifying_order_id" ON "public"."profiles" USING "btree" ("club_qualifying_order_id") WHERE ("club_qualifying_order_id" IS NOT NULL);



CREATE INDEX "idx_profiles_customer_display_id" ON "public"."profiles" USING "btree" ("customer_display_id");



CREATE INDEX "idx_review_media_review_id" ON "public"."review_media" USING "btree" ("review_id");



CREATE INDEX "idx_reviews_user_id" ON "public"."reviews" USING "btree" ("user_id");



CREATE INDEX "idx_reward_transactions_created_at" ON "public"."reward_transactions" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reward_transactions_wallet_id" ON "public"."reward_transactions" USING "btree" ("wallet_id");



CREATE INDEX "idx_reward_wallets_user_id" ON "public"."reward_wallets" USING "btree" ("user_id");



CREATE INDEX "idx_trivara_order_bookings_order_id" ON "public"."trivara_order_bookings" USING "btree" ("order_id");



CREATE INDEX "idx_trivara_order_bookings_status" ON "public"."trivara_order_bookings" USING "btree" ("status");



CREATE INDEX "idx_wishlist_items_product_id" ON "public"."wishlist_items" USING "btree" ("product_id");



CREATE INDEX "products_image_embedding_idx" ON "public"."products" USING "hnsw" ("image_embedding" "extensions"."vector_cosine_ops");



COMMENT ON INDEX "public"."products_image_embedding_idx" IS 'HNSW index for fast approximate nearest neighbor search on image embeddings.
Parameters: m=16 (connections per layer), ef_construction=64 (build quality).
Optimized for datasets of 100-10,000 products.';



CREATE INDEX "products_name_trgm_idx" ON "public"."products" USING "gin" ("name" "extensions"."gin_trgm_ops");



CREATE INDEX "products_search_vector_idx" ON "public"."products" USING "gin" ("search_vector");



CREATE INDEX "search_analytics_created_at_idx" ON "public"."search_analytics" USING "btree" ("created_at");



CREATE INDEX "search_analytics_query_idx" ON "public"."search_analytics" USING "btree" ("search_query");



CREATE OR REPLACE TRIGGER "on_order_placed" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();



CREATE OR REPLACE TRIGGER "on_review_submitted" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();



CREATE OR REPLACE TRIGGER "on_user_signup" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();



CREATE OR REPLACE TRIGGER "set_trivara_order_bookings_updated_at" BEFORE UPDATE ON "public"."trivara_order_bookings" FOR EACH ROW EXECUTE FUNCTION "public"."update_trivara_order_bookings_updated_at"();



CREATE OR REPLACE TRIGGER "set_trivara_sync_snapshots_updated_at" BEFORE UPDATE ON "public"."trivara_sync_snapshots" FOR EACH ROW EXECUTE FUNCTION "public"."update_trivara_sync_snapshots_updated_at"();



CREATE OR REPLACE TRIGGER "update_home_banners_updated_at" BEFORE UPDATE ON "public"."home_banners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_home_exclusive_collections_updated_at" BEFORE UPDATE ON "public"."home_exclusive_collections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_promo_code_fkey" FOREIGN KEY ("promo_code") REFERENCES "public"."promotions"("code");



ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_timeline"
    ADD CONSTRAINT "order_timeline_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_promo_code_fkey" FOREIGN KEY ("promo_code") REFERENCES "public"."promotions"("code");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shipping_partner_id_fkey" FOREIGN KEY ("shipping_partner_id") REFERENCES "public"."shipping_partners"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_admin_role_id_fkey" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."reward_wallets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."trivara_order_bookings"
    ADD CONSTRAINT "trivara_order_bookings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete admin_roles" ON "public"."admin_roles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can delete categories" ON "public"."categories" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete collections" ON "public"."collections" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete exclusive collections" ON "public"."home_exclusive_collections" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete global settings" ON "public"."global_settings" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete home banners" ON "public"."home_banners" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete home reviews" ON "public"."home_reviews" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete orders" ON "public"."orders" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete payment_providers" ON "public"."payment_providers" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_categories" ON "public"."product_categories" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_collections" ON "public"."product_collections" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_combinations" ON "public"."product_combinations" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_option_values" ON "public"."product_option_values" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_options" ON "public"."product_options" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete product_variants" ON "public"."product_variants" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete products" ON "public"."products" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete promotions" ON "public"."promotions" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete review media" ON "public"."review_media" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete reviews" ON "public"."reviews" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete search_analytics" ON "public"."search_analytics" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete shipping_options" ON "public"."shipping_options" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can delete shipping_partners" ON "public"."shipping_partners" FOR DELETE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert admin_roles" ON "public"."admin_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert categories" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert collections" ON "public"."collections" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert exclusive collections" ON "public"."home_exclusive_collections" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert global settings" ON "public"."global_settings" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert home banners" ON "public"."home_banners" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert home reviews" ON "public"."home_reviews" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert notifications" ON "public"."admin_notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can insert payment_providers" ON "public"."payment_providers" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_categories" ON "public"."product_categories" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_collections" ON "public"."product_collections" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_combinations" ON "public"."product_combinations" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_option_values" ON "public"."product_option_values" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_options" ON "public"."product_options" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert product_variants" ON "public"."product_variants" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert promotions" ON "public"."promotions" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert shipping_options" ON "public"."shipping_options" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can insert shipping_partners" ON "public"."shipping_partners" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can read search_analytics" ON "public"."search_analytics" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update admin_roles" ON "public"."admin_roles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update categories" ON "public"."categories" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update club_settings" ON "public"."club_settings" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update collections" ON "public"."collections" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update exclusive collections" ON "public"."home_exclusive_collections" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update global settings" ON "public"."global_settings" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update home banners" ON "public"."home_banners" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update home reviews" ON "public"."home_reviews" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update notifications" ON "public"."admin_notifications" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can update orders only" ON "public"."orders" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update payment_providers" ON "public"."payment_providers" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_categories" ON "public"."product_categories" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_collections" ON "public"."product_collections" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_combinations" ON "public"."product_combinations" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_option_values" ON "public"."product_option_values" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_options" ON "public"."product_options" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update product_variants" ON "public"."product_variants" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update products" ON "public"."products" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update promotions" ON "public"."promotions" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update review media" ON "public"."review_media" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update reviews" ON "public"."reviews" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update search_analytics" ON "public"."search_analytics" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update shipping_options" ON "public"."shipping_options" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can update shipping_partners" ON "public"."shipping_partners" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "Admins can view notifications" ON "public"."admin_notifications" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins can write order_timeline" ON "public"."order_timeline" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for product combinations" ON "public"."product_combinations" FOR SELECT USING (true);



CREATE POLICY "Guests access carts by ID" ON "public"."carts" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Home reviews are viewable by everyone" ON "public"."home_reviews" FOR SELECT USING (true);



CREATE POLICY "Only users with customers:delete can delete customers" ON "public"."profiles" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('customers:delete'::"text") AS "has_permission"));



CREATE POLICY "Orders are visible to customers and admins" ON "public"."orders" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Public and admins can view exclusive collections" ON "public"."home_exclusive_collections" FOR SELECT USING ((("is_active" = true) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Public and admins can view home banners" ON "public"."home_banners" FOR SELECT USING (((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Public and admins can view promotions" ON "public"."promotions" FOR SELECT USING (((("is_active" = true) AND ("is_deleted" = false) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"()))) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Public can insert search_analytics" ON "public"."search_analytics" FOR INSERT WITH CHECK (true);



CREATE POLICY "Public can read global settings" ON "public"."global_settings" FOR SELECT USING (true);



CREATE POLICY "Public can view approved reviews" ON "public"."reviews" FOR SELECT TO "anon" USING (("approval_status" = 'approved'::"text"));



CREATE POLICY "Public can view review media" ON "public"."review_media" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."image" FOR SELECT USING (true);



CREATE POLICY "Public read access" ON "public"."product_images" FOR SELECT USING (true);



CREATE POLICY "Public read admin_roles" ON "public"."admin_roles" FOR SELECT USING (true);



CREATE POLICY "Public read categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Public read club settings" ON "public"."club_settings" FOR SELECT USING (true);



CREATE POLICY "Public read collections" ON "public"."collections" FOR SELECT USING (true);



CREATE POLICY "Public read order_timeline" ON "public"."order_timeline" FOR SELECT USING (true);



CREATE POLICY "Public read payment_providers" ON "public"."payment_providers" FOR SELECT USING (true);



CREATE POLICY "Public read product_categories" ON "public"."product_categories" FOR SELECT USING (true);



CREATE POLICY "Public read product_collections" ON "public"."product_collections" FOR SELECT USING (true);



CREATE POLICY "Public read product_option_values" ON "public"."product_option_values" FOR SELECT USING (true);



CREATE POLICY "Public read product_options" ON "public"."product_options" FOR SELECT USING (true);



CREATE POLICY "Public read shipping_options" ON "public"."shipping_options" FOR SELECT USING (true);



CREATE POLICY "Public read shipping_partners" ON "public"."shipping_partners" FOR SELECT USING (true);



CREATE POLICY "Public read variants" ON "public"."product_variants" FOR SELECT USING (true);



CREATE POLICY "Users and admins access cart_items" ON "public"."cart_items" TO "authenticated" USING ((("cart_id" IN ( SELECT "carts"."id"
   FROM "public"."carts"
  WHERE ("carts"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("cart_id" IN ( SELECT "carts"."id"
   FROM "public"."carts"
  WHERE ("carts"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins access carts" ON "public"."carts" TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can create orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can create reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can update profiles" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin"))) WITH CHECK ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can upload review media" ON "public"."review_media" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (EXISTS ( SELECT 1
   FROM "public"."reviews" "r"
  WHERE (("r"."id" = "review_media"."review_id") AND ("r"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users and admins can view addresses" ON "public"."addresses" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can view profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can view reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING ((("approval_status" = 'approved'::"text") OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can view reward transactions" ON "public"."reward_transactions" FOR SELECT TO "authenticated" USING ((("wallet_id" IN ( SELECT "rw"."id"
   FROM "public"."reward_wallets" "rw"
  WHERE ("rw"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users and admins can view reward wallets" ON "public"."reward_wallets" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_admin"() AS "is_admin")));



CREATE POLICY "Users can create own transactions" ON "public"."reward_transactions" FOR INSERT TO "authenticated" WITH CHECK (("wallet_id" IN ( SELECT "reward_wallets"."id"
   FROM "public"."reward_wallets"
  WHERE ("reward_wallets"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can create own wallet" ON "public"."reward_wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can delete their own addresses" ON "public"."addresses" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can insert their own addresses" ON "public"."addresses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can manage their own wishlist items" ON "public"."wishlist_items" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update own wallet" ON "public"."reward_wallets" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can update their own addresses" ON "public"."addresses" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."carts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."club_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_exclusive_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."home_reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."image" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_timeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payment_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_collections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_combinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_option_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."review_media" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reward_wallets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."search_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_options" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipping_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trivara_order_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."trivara_sync_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wishlist_items" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "postgres";






















































































































































































































































































































































































































































































































































































































































REVOKE ALL ON FUNCTION "public"."check_is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_storefront_product_price_bounds"("p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_admin_notification"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_admin_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric, "p_max_price" numeric, "p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text", "p_sort_by" "text", "p_offset" integer, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric, "p_max_price" numeric, "p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text", "p_sort_by" "text", "p_offset" integer, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_storefront_products_by_price"("p_min_price" numeric, "p_max_price" numeric, "p_category_ids" "text"[], "p_collection_ids" "text"[], "p_product_ids" "text"[], "p_search_query" "text", "p_availability" "text", "p_sort_by" "text", "p_offset" integer, "p_limit" integer) TO "service_role";






GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "anon";
GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "service_role";






GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trivara_order_bookings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trivara_order_bookings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trivara_order_bookings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_trivara_sync_snapshots_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_trivara_sync_snapshots_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_trivara_sync_snapshots_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";






























GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."account_order_summaries" TO "anon";
GRANT ALL ON TABLE "public"."account_order_summaries" TO "authenticated";
GRANT ALL ON TABLE "public"."account_order_summaries" TO "service_role";



GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";



GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";



GRANT ALL ON TABLE "public"."carts" TO "anon";
GRANT ALL ON TABLE "public"."carts" TO "authenticated";
GRANT ALL ON TABLE "public"."carts" TO "service_role";



GRANT ALL ON TABLE "public"."club_settings" TO "anon";
GRANT ALL ON TABLE "public"."club_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."club_settings" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";



GRANT ALL ON TABLE "public"."home_banners" TO "anon";
GRANT ALL ON TABLE "public"."home_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."home_banners" TO "service_role";



GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "anon";
GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "service_role";



GRANT ALL ON TABLE "public"."home_reviews" TO "anon";
GRANT ALL ON TABLE "public"."home_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."home_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."image" TO "anon";
GRANT ALL ON TABLE "public"."image" TO "authenticated";
GRANT ALL ON TABLE "public"."image" TO "service_role";



GRANT ALL ON TABLE "public"."order_timeline" TO "anon";
GRANT ALL ON TABLE "public"."order_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."order_timeline" TO "service_role";



GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_codes" TO "service_role";



GRANT ALL ON TABLE "public"."payment_providers" TO "anon";
GRANT ALL ON TABLE "public"."payment_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_providers" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."product_collections" TO "anon";
GRANT ALL ON TABLE "public"."product_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."product_collections" TO "service_role";



GRANT ALL ON TABLE "public"."product_combinations" TO "anon";
GRANT ALL ON TABLE "public"."product_combinations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_combinations" TO "service_role";



GRANT ALL ON TABLE "public"."product_images" TO "anon";
GRANT ALL ON TABLE "public"."product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_images" TO "service_role";



GRANT ALL ON TABLE "public"."product_option_values" TO "anon";
GRANT ALL ON TABLE "public"."product_option_values" TO "authenticated";
GRANT ALL ON TABLE "public"."product_option_values" TO "service_role";



GRANT ALL ON TABLE "public"."product_options" TO "anon";
GRANT ALL ON TABLE "public"."product_options" TO "authenticated";
GRANT ALL ON TABLE "public"."product_options" TO "service_role";



GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";



GRANT ALL ON TABLE "public"."review_media" TO "anon";
GRANT ALL ON TABLE "public"."review_media" TO "authenticated";
GRANT ALL ON TABLE "public"."review_media" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."reward_transactions" TO "anon";
GRANT ALL ON TABLE "public"."reward_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."reward_wallets" TO "anon";
GRANT ALL ON TABLE "public"."reward_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_wallets" TO "service_role";



GRANT ALL ON TABLE "public"."search_analytics" TO "anon";
GRANT ALL ON TABLE "public"."search_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."search_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_options" TO "anon";
GRANT ALL ON TABLE "public"."shipping_options" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_options" TO "service_role";



GRANT ALL ON TABLE "public"."shipping_partners" TO "anon";
GRANT ALL ON TABLE "public"."shipping_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_partners" TO "service_role";



GRANT ALL ON TABLE "public"."trivara_order_bookings" TO "anon";
GRANT ALL ON TABLE "public"."trivara_order_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."trivara_order_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."trivara_sync_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."trivara_sync_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."trivara_sync_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."wishlist_items" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";





























--
-- PostgreSQL database dump
--

-- \restrict GuiSbCUjydD7TLUKsIyfIizP0iIPmkHwas3DJuUZG9XqBnfDLflQjMRakFNgIV2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: hypopg; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "hypopg"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "hypopg" IS 'Hypothetical indexes for PostgreSQL';


--
-- Name: index_advisor; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "index_advisor"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "index_advisor" IS 'Query index advisor';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_stat_statements"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pg_stat_statements" IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pg_trgm"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pg_trgm" IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "unaccent"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "unaccent" IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "vector"; Type: COMMENT; Schema: -; Owner: 
--

-- COMMENT ON EXTENSION "vector" IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: check_is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: create_order_with_payment("text", "text", "jsonb", "jsonb", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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
  v_has_gift_wrap_line BOOLEAN := FALSE;
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
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
            ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100))
          END,
          'original_unit_price', CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
            ELSE COALESCE(pv.price, p.price, 0)
          END,
          'total', (
            CASE
              WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
              ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100))
            END
          ) * ci.quantity,
          'original_total', (
            CASE
              WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
              ELSE COALESCE(pv.price, p.price, 0)
            END
          ) * ci.quantity,
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
    COALESCE(
      SUM(
        (
          CASE
            WHEN COALESCE((ci.metadata->>'gift_wrap_line')::boolean, false) = true THEN COALESCE((ci.metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
            ELSE ROUND(COALESCE(pv.price, p.price, 0) * (1 - v_club_discount_percentage / 100))
          END
        ) * ci.quantity
      ),
      0
    ),
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
    )
  INTO
    v_items_json,
    v_item_subtotal,
    v_item_subtotal_before_club
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.product_id = p.id
  LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
  WHERE ci.cart_id = p_cart_id;

  -- Gift wrap fallback: when the gift_wrap_line cart item fails to persist to the DB (silent
  -- RLS/FK failure), derive the fee from the main product item's gift_wrap metadata flag so
  -- the order total is still correct.
  SELECT EXISTS(
    SELECT 1 FROM public.cart_items
    WHERE cart_id = p_cart_id
      AND (metadata->>'gift_wrap_line')::boolean = true
  ) INTO v_has_gift_wrap_line;

  IF v_has_gift_wrap_line THEN
    -- Fee already included in v_item_subtotal; just record the amount for metadata.
    v_gift_wrap_amount := COALESCE(
      (
        SELECT COALESCE((metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
        FROM public.cart_items
        WHERE cart_id = p_cart_id
          AND (metadata->>'gift_wrap_line')::boolean = true
        LIMIT 1
      ),
      0
    );
  ELSE
    -- Fallback: check if a product item carries the gift_wrap flag.
    v_gift_wrap_amount := COALESCE(
      (
        SELECT COALESCE((metadata->>'gift_wrap_fee')::numeric, v_gift_wrap_setting_fee)
        FROM public.cart_items
        WHERE cart_id = p_cart_id
          AND (metadata->>'gift_wrap')::boolean = true
        LIMIT 1
      ),
      0
    );
    IF v_gift_wrap_amount > 0 THEN
      -- Add the missing gift wrap fee to both subtotals so club_savings and payment
      -- discount are computed on the correct base.
      v_item_subtotal := v_item_subtotal + v_gift_wrap_amount;
      v_item_subtotal_before_club := v_item_subtotal_before_club + v_gift_wrap_amount;
    END IF;
  END IF;

  v_club_savings := COALESCE(v_item_subtotal_before_club - v_item_subtotal, 0);

  IF v_payment_discount_percentage > 0 THEN
    v_payment_discount_amount := ROUND(
      v_item_subtotal * (v_payment_discount_percentage / 100)
    );
  END IF;

  v_total_discount :=
    COALESCE(p_rewards_to_apply, 0) +
    COALESCE(v_promo_discount, 0) +
    COALESCE(v_payment_discount_amount, 0);

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
        v_shipping_total := v_amount;
      END IF;
    END;
  END IF;

  v_final_total := GREATEST(
    0,
    v_item_subtotal +
    COALESCE(v_tax_total, 0) +
    v_shipping_total -
    v_total_discount
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

--
-- Name: handle_admin_notification(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$ BEGIN INSERT INTO public.profiles (id, email, first_name, last_name, phone, created_at, updated_at) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''), COALESCE(NULLIF(NEW.phone, ''), NEW.raw_user_meta_data->>'phone_number', NEW.raw_user_meta_data->>'phone', ''), NOW(), NOW()) ON CONFLICT (id) DO NOTHING; RETURN NEW; END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

--
-- Name: handle_user_update(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: has_permission("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: FUNCTION "has_permission"("required_permission" "text"); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."has_permission"("required_permission" "text") IS 'Checks if the current authenticated user has the specified permission. 
   Supports wildcards: "*" for full access and "resource:*" for category access.
   Returns FALSE if user has no role assigned.';


--
-- Name: increment_promotion_uses("text"); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: match_products("extensions"."vector", double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: parent_category("public"."categories"); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."parent_category"("public"."categories") RETURNS SETOF "public"."categories"
    LANGUAGE "sql" STABLE ROWS 1
    SET "search_path" TO 'public', 'extensions', 'pg_catalog', 'pg_temp'
    AS $_$
  SELECT * FROM categories WHERE id = $1.parent_category_id
$_$;


ALTER FUNCTION "public"."parent_category"("public"."categories") OWNER TO "postgres";

--
-- Name: reorder_exclusive_collections("uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: reorder_home_banners("uuid"[]); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: search_products_advanced("text", double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: search_products_multimodal("text", "extensions"."vector", double precision, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE OR REPLACE FUNCTION "public"."search_products_multimodal"("search_query" "text" DEFAULT NULL::"text", "search_embedding" "extensions"."vector" DEFAULT NULL::"extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 20) RETURNS TABLE("id" "text", "name" "text", "handle" "text", "image_url" "text", "thumbnail" "text", "price" numeric, "currency_code" "text", "relevance_score" double precision)
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

--
-- Name: FUNCTION "search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer); Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) IS 'Hybrid search combining text and image embeddings for active storefront products only. Last updated 2026-03-14.';


--
-- Name: track_search_rpc("text", "text", integer, "text", "text", integer); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

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

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: admin_notifications; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: admin_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."admin_roles" (
    "id" "text" DEFAULT ('role_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "is_system" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_roles" OWNER TO "postgres";

--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: carts; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: club_settings; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: collections; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: customer_display_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."customer_display_id_seq"
    START WITH 1001
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customer_display_id_seq" OWNER TO "postgres";

--
-- Name: global_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."global_settings" (
    "id" "text" DEFAULT 'default'::"text" NOT NULL,
    "gift_wrap_fee" numeric DEFAULT 50 NOT NULL,
    "is_gift_wrap_enabled" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."global_settings" OWNER TO "postgres";

--
-- Name: TABLE "global_settings"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."global_settings" IS 'Global application settings. RLS enabled - public read, admin write.';


--
-- Name: home_banners; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: home_exclusive_collections; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: home_reviews; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."home_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."home_reviews" OWNER TO "postgres";

--
-- Name: image; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."image" (
    "id" "text" DEFAULT ('img_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "url" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."image" OWNER TO "postgres";

--
-- Name: order_timeline; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: orders_display_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE IF NOT EXISTS "public"."orders_display_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."orders_display_id_seq" OWNER TO "postgres";

--
-- Name: orders_display_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE "public"."orders_display_id_seq" OWNED BY "public"."orders"."display_id";


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: payment_providers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."payment_providers" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "discount_percentage" numeric DEFAULT 0
);


ALTER TABLE "public"."payment_providers" OWNER TO "postgres";

--
-- Name: product_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "product_id" "text" NOT NULL,
    "category_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";

--
-- Name: product_collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_collections" (
    "id" "text" DEFAULT ('pc_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "product_id" "text" NOT NULL,
    "collection_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_collections" OWNER TO "postgres";

--
-- Name: product_combinations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_combinations" (
    "id" "text" DEFAULT ('comb_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "product_id" "text" NOT NULL,
    "related_product_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_combinations" OWNER TO "postgres";

--
-- Name: TABLE "product_combinations"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."product_combinations" IS 'Stores manually selected product relationships for "Frequently Bought Together" feature.';


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_images" (
    "product_id" "text" NOT NULL,
    "image_id" "text" NOT NULL
);


ALTER TABLE "public"."product_images" OWNER TO "postgres";

--
-- Name: product_option_values; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: TABLE "product_option_values"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."product_option_values" IS 'Stores values for product options and links to variants';


--
-- Name: product_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."product_options" (
    "id" "text" DEFAULT ('opt_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "title" "text" NOT NULL,
    "product_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_options" OWNER TO "postgres";

--
-- Name: TABLE "product_options"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."product_options" IS 'Stores product options like Color, Size, etc.';


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: COLUMN "products"."image_embedding"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."products"."image_embedding" IS '512-dimensional CLIP ViT-B-32 image embedding for visual similarity search. 
Generated using Transformers.js CLIP model. Must be L2-normalized before storage.';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

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
    "contact_email" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";

--
-- Name: promotions; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: review_media; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: reward_transactions; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: reward_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."reward_wallets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reward_wallets" OWNER TO "postgres";

--
-- Name: search_analytics; Type: TABLE; Schema: public; Owner: postgres
--

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

--
-- Name: TABLE "search_analytics"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE "public"."search_analytics" IS 'Search analytics with session tracking. RLS enabled - public insert, admin read only.';


--
-- Name: shipping_options; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."shipping_options" (
    "id" "text" DEFAULT ('so_'::"text" || "substr"("md5"(("random"())::"text"), 1, 10)) NOT NULL,
    "name" "text" NOT NULL,
    "amount" numeric DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "min_order_free_shipping" numeric(10,2) DEFAULT NULL::numeric
);


ALTER TABLE "public"."shipping_options" OWNER TO "postgres";

--
-- Name: COLUMN "shipping_options"."min_order_free_shipping"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN "public"."shipping_options"."min_order_free_shipping" IS 'Order subtotal threshold above which shipping is free. NULL means never free (unless covered by other rules).';


--
-- Name: shipping_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."shipping_partners" (
    "id" "text" DEFAULT ('sp_'::"text" || "extensions"."uuid_generate_v4"()) NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."shipping_partners" OWNER TO "postgres";

--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE IF NOT EXISTS "public"."wishlist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."wishlist_items" OWNER TO "postgres";

--
-- Name: orders display_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders" ALTER COLUMN "display_id" SET DEFAULT "nextval"('"public"."orders_display_id_seq"'::"regclass");


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");


--
-- Name: admin_notifications admin_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");


--
-- Name: admin_roles admin_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_name_key" UNIQUE ("name");


--
-- Name: admin_roles admin_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."admin_roles"
    ADD CONSTRAINT "admin_roles_pkey" PRIMARY KEY ("id");


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id");


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_pkey" PRIMARY KEY ("id");


--
-- Name: categories categories_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_handle_key" UNIQUE ("handle");


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");


--
-- Name: club_settings club_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."club_settings"
    ADD CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id");


--
-- Name: collections collections_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_handle_key" UNIQUE ("handle");


--
-- Name: collections collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");


--
-- Name: global_settings global_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."global_settings"
    ADD CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id");


--
-- Name: home_banners home_banners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id");


--
-- Name: home_exclusive_collections home_exclusive_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_pkey" PRIMARY KEY ("id");


--
-- Name: home_exclusive_collections home_exclusive_collections_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_product_id_key" UNIQUE ("product_id");


--
-- Name: home_reviews home_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_pkey" PRIMARY KEY ("id");


--
-- Name: home_reviews home_reviews_review_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_review_id_key" UNIQUE ("review_id");


--
-- Name: image image_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."image"
    ADD CONSTRAINT "image_pkey" PRIMARY KEY ("id");


--
-- Name: order_timeline order_timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_timeline"
    ADD CONSTRAINT "order_timeline_pkey" PRIMARY KEY ("id");


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."otp_codes"
    ADD CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id");


--
-- Name: payment_providers payment_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."payment_providers"
    ADD CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id");


--
-- Name: product_categories product_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id", "category_id");


--
-- Name: product_collections product_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_pkey" PRIMARY KEY ("id");


--
-- Name: product_collections product_collections_product_id_collection_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_product_id_collection_id_key" UNIQUE ("product_id", "collection_id");


--
-- Name: product_combinations product_combinations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_pkey" PRIMARY KEY ("id");


--
-- Name: product_combinations product_combinations_product_id_related_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_product_id_related_product_id_key" UNIQUE ("product_id", "related_product_id");


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_pkey" PRIMARY KEY ("product_id", "image_id");


--
-- Name: product_option_values product_option_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id");


--
-- Name: product_options product_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_pkey" PRIMARY KEY ("id");


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id");


--
-- Name: products products_handle_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_handle_key" UNIQUE ("handle");


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");


--
-- Name: promotions promotions_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_code_key" UNIQUE ("code");


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."promotions"
    ADD CONSTRAINT "promotions_pkey" PRIMARY KEY ("id");


--
-- Name: review_media review_media_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_pkey" PRIMARY KEY ("id");


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");


--
-- Name: reward_transactions reward_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_pkey" PRIMARY KEY ("id");


--
-- Name: reward_wallets reward_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_pkey" PRIMARY KEY ("id");


--
-- Name: reward_wallets reward_wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_user_id_key" UNIQUE ("user_id");


--
-- Name: search_analytics search_analytics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."search_analytics"
    ADD CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id");


--
-- Name: shipping_options shipping_options_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."shipping_options"
    ADD CONSTRAINT "shipping_options_pkey" PRIMARY KEY ("id");


--
-- Name: shipping_partners shipping_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."shipping_partners"
    ADD CONSTRAINT "shipping_partners_pkey" PRIMARY KEY ("id");


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id");


--
-- Name: wishlist_items wishlist_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_product_id_key" UNIQUE ("user_id", "product_id");


--
-- Name: idx_addresses_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_addresses_user_id" ON "public"."addresses" USING "btree" ("user_id");


--
-- Name: idx_admin_roles_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_roles_id" ON "public"."admin_roles" USING "btree" ("id");


--
-- Name: idx_admin_roles_permissions; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_admin_roles_permissions" ON "public"."admin_roles" USING "gin" ("permissions");


--
-- Name: idx_cart_items_cart_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cart_items_cart_id" ON "public"."cart_items" USING "btree" ("cart_id");


--
-- Name: idx_cart_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cart_items_product_id" ON "public"."cart_items" USING "btree" ("product_id");


--
-- Name: idx_cart_items_variant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_cart_items_variant_id" ON "public"."cart_items" USING "btree" ("variant_id");


--
-- Name: idx_carts_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_carts_user_id" ON "public"."carts" USING "btree" ("user_id");


--
-- Name: idx_exclusive_collections_active_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_exclusive_collections_active_sort" ON "public"."home_exclusive_collections" USING "btree" ("is_active", "sort_order") WHERE ("is_active" = true);


--
-- Name: idx_home_banners_active_sort; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_home_banners_active_sort" ON "public"."home_banners" USING "btree" ("is_active", "sort_order") WHERE ("is_active" = true);


--
-- Name: idx_home_banners_schedule; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_home_banners_schedule" ON "public"."home_banners" USING "btree" ("starts_at", "ends_at") WHERE ("is_active" = true);


--
-- Name: idx_order_timeline_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_timeline_created_at" ON "public"."order_timeline" USING "btree" ("created_at" DESC);


--
-- Name: idx_order_timeline_order_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_order_timeline_order_id" ON "public"."order_timeline" USING "btree" ("order_id");


--
-- Name: idx_orders_pending_cart_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "idx_orders_pending_cart_id" ON "public"."orders" USING "btree" ((("metadata" ->> 'cart_id'::"text"))) WHERE ("status" = 'pending'::"text");


--
-- Name: idx_orders_shipping_partner_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_shipping_partner_id" ON "public"."orders" USING "btree" ("shipping_partner_id");


--
-- Name: idx_orders_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_orders_user_id" ON "public"."orders" USING "btree" ("user_id");


--
-- Name: idx_otp_codes_delivery_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_otp_codes_delivery_status" ON "public"."otp_codes" USING "btree" ("delivery_status");


--
-- Name: idx_otp_codes_expires_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_otp_codes_expires_at" ON "public"."otp_codes" USING "btree" ("expires_at");


--
-- Name: idx_otp_codes_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_otp_codes_phone" ON "public"."otp_codes" USING "btree" ("phone");


--
-- Name: idx_otp_codes_phone_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_otp_codes_phone_active" ON "public"."otp_codes" USING "btree" ("phone", "created_at" DESC) WHERE ("verified" = false);


--
-- Name: idx_product_categories_category_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_categories_category_id" ON "public"."product_categories" USING "btree" ("category_id");


--
-- Name: idx_product_collections_collection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_collections_collection_id" ON "public"."product_collections" USING "btree" ("collection_id");


--
-- Name: idx_product_images_image_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_images_image_id" ON "public"."product_images" USING "btree" ("image_id");


--
-- Name: idx_product_option_values_option_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_option_values_option_id" ON "public"."product_option_values" USING "btree" ("option_id");


--
-- Name: idx_product_option_values_variant_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_option_values_variant_id" ON "public"."product_option_values" USING "btree" ("variant_id");


--
-- Name: idx_product_options_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_options_product_id" ON "public"."product_options" USING "btree" ("product_id");


--
-- Name: idx_product_variants_compare_at_price; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_variants_compare_at_price" ON "public"."product_variants" USING "btree" ("compare_at_price");


--
-- Name: idx_product_variants_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_product_variants_product_id" ON "public"."product_variants" USING "btree" ("product_id");


--
-- Name: idx_products_collection_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_collection_id" ON "public"."products" USING "btree" ("collection_id");


--
-- Name: idx_products_seo_metadata_gin; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_products_seo_metadata_gin" ON "public"."products" USING "gin" ("seo_metadata");


--
-- Name: idx_profiles_admin_role_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_admin_role_id" ON "public"."profiles" USING "btree" ("admin_role_id");


--
-- Name: idx_profiles_customer_display_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_profiles_customer_display_id" ON "public"."profiles" USING "btree" ("customer_display_id");


--
-- Name: idx_review_media_review_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_review_media_review_id" ON "public"."review_media" USING "btree" ("review_id");


--
-- Name: idx_reviews_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reviews_user_id" ON "public"."reviews" USING "btree" ("user_id");


--
-- Name: idx_reward_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reward_transactions_created_at" ON "public"."reward_transactions" USING "btree" ("created_at" DESC);


--
-- Name: idx_reward_transactions_wallet_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reward_transactions_wallet_id" ON "public"."reward_transactions" USING "btree" ("wallet_id");


--
-- Name: idx_reward_wallets_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_reward_wallets_user_id" ON "public"."reward_wallets" USING "btree" ("user_id");


--
-- Name: idx_wishlist_items_product_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "idx_wishlist_items_product_id" ON "public"."wishlist_items" USING "btree" ("product_id");


--
-- Name: products_image_embedding_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "products_image_embedding_idx" ON "public"."products" USING "hnsw" ("image_embedding" "extensions"."vector_cosine_ops");


--
-- Name: INDEX "products_image_embedding_idx"; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON INDEX "public"."products_image_embedding_idx" IS 'HNSW index for fast approximate nearest neighbor search on image embeddings.
Parameters: m=16 (connections per layer), ef_construction=64 (build quality).
Optimized for datasets of 100-10,000 products.';


--
-- Name: products_name_trgm_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "products_name_trgm_idx" ON "public"."products" USING "gin" ("name" "extensions"."gin_trgm_ops");


--
-- Name: products_search_vector_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "products_search_vector_idx" ON "public"."products" USING "gin" ("search_vector");


--
-- Name: search_analytics_created_at_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "search_analytics_created_at_idx" ON "public"."search_analytics" USING "btree" ("created_at");


--
-- Name: search_analytics_query_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "search_analytics_query_idx" ON "public"."search_analytics" USING "btree" ("search_query");


--
-- Name: orders on_order_placed; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_order_placed" AFTER INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();


--
-- Name: reviews on_review_submitted; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_review_submitted" AFTER INSERT ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();


--
-- Name: profiles on_user_signup; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "on_user_signup" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_admin_notification"();


--
-- Name: home_banners update_home_banners_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_home_banners_updated_at" BEFORE UPDATE ON "public"."home_banners" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: home_exclusive_collections update_home_exclusive_collections_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE OR REPLACE TRIGGER "update_home_exclusive_collections_updated_at" BEFORE UPDATE ON "public"."home_exclusive_collections" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();


--
-- Name: addresses addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: cart_items cart_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."cart_items"
    ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;


--
-- Name: carts carts_promo_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_promo_code_fkey" FOREIGN KEY ("promo_code") REFERENCES "public"."promotions"("code");


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."carts"
    ADD CONSTRAINT "carts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: categories categories_parent_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_category_id_fkey" FOREIGN KEY ("parent_category_id") REFERENCES "public"."categories"("id");


--
-- Name: home_banners home_banners_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: home_banners home_banners_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_banners"
    ADD CONSTRAINT "home_banners_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: home_exclusive_collections home_exclusive_collections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: home_exclusive_collections home_exclusive_collections_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: home_exclusive_collections home_exclusive_collections_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_exclusive_collections"
    ADD CONSTRAINT "home_exclusive_collections_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;


--
-- Name: home_reviews home_reviews_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");


--
-- Name: home_reviews home_reviews_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."home_reviews"
    ADD CONSTRAINT "home_reviews_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;


--
-- Name: order_timeline order_timeline_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."order_timeline"
    ADD CONSTRAINT "order_timeline_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;


--
-- Name: orders orders_promo_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_promo_code_fkey" FOREIGN KEY ("promo_code") REFERENCES "public"."promotions"("code");


--
-- Name: orders orders_shipping_partner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_shipping_partner_id_fkey" FOREIGN KEY ("shipping_partner_id") REFERENCES "public"."shipping_partners"("id");


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: product_categories product_categories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;


--
-- Name: product_categories product_categories_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_collections product_collections_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;


--
-- Name: product_collections product_collections_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_collections"
    ADD CONSTRAINT "product_collections_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_combinations product_combinations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_combinations product_combinations_related_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_combinations"
    ADD CONSTRAINT "product_combinations_related_product_id_fkey" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_images product_images_image_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "public"."image"("id") ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_images"
    ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_option_values product_option_values_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "public"."product_options"("id") ON DELETE CASCADE;


--
-- Name: product_option_values product_option_values_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_option_values"
    ADD CONSTRAINT "product_option_values_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE CASCADE;


--
-- Name: product_options product_options_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_options"
    ADD CONSTRAINT "product_options_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."product_variants"
    ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: products products_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE SET NULL;


--
-- Name: profiles profiles_admin_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_admin_role_id_fkey" FOREIGN KEY ("admin_role_id") REFERENCES "public"."admin_roles"("id");


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: review_media review_media_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."review_media"
    ADD CONSTRAINT "review_media_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: reward_transactions reward_transactions_wallet_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reward_transactions"
    ADD CONSTRAINT "reward_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "public"."reward_wallets"("id") ON DELETE CASCADE;


--
-- Name: reward_wallets reward_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."reward_wallets"
    ADD CONSTRAINT "reward_wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY "public"."wishlist_items"
    ADD CONSTRAINT "wishlist_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;


--
-- Name: admin_roles Admins can delete admin_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can delete admin_roles" ON "public"."admin_roles" FOR DELETE TO "authenticated" USING ("public"."is_admin"());


--
-- Name: admin_roles Admins can insert admin_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert admin_roles" ON "public"."admin_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());


--
-- Name: admin_notifications Admins can insert notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can insert notifications" ON "public"."admin_notifications" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());


--
-- Name: categories Admins can manage categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage categories" ON "public"."categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: collections Admins can manage collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage collections" ON "public"."collections" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: home_exclusive_collections Admins can manage exclusive collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage exclusive collections" ON "public"."home_exclusive_collections" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: global_settings Admins can manage global settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage global settings" ON "public"."global_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: home_banners Admins can manage home banners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage home banners" ON "public"."home_banners" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: home_reviews Admins can manage home reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage home reviews" ON "public"."home_reviews" USING (true);


--
-- Name: product_collections Admins can manage product_collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage product_collections" ON "public"."product_collections" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: product_option_values Admins can manage product_option_values; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage product_option_values" ON "public"."product_option_values" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: product_options Admins can manage product_options; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage product_options" ON "public"."product_options" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: product_variants Admins can manage product_variants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage product_variants" ON "public"."product_variants" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: products Admins can manage products; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage products" ON "public"."products" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: review_media Admins can manage review media; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage review media" ON "public"."review_media" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: reviews Admins can manage reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage reviews" ON "public"."reviews" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: search_analytics Admins can manage search_analytics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage search_analytics" ON "public"."search_analytics" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: shipping_partners Admins can manage shipping_partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can manage shipping_partners" ON "public"."shipping_partners" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: profiles Admins can read all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can read all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."is_admin"());


--
-- Name: orders Admins can see all orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can see all orders" ON "public"."orders" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: admin_roles Admins can update admin_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update admin_roles" ON "public"."admin_roles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: profiles Admins can update any profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: club_settings Admins can update club_settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update club_settings" ON "public"."club_settings" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: admin_notifications Admins can update notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update notifications" ON "public"."admin_notifications" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: orders Admins can update orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING ("public"."check_is_admin"());


--
-- Name: profiles Admins can view all profiles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."check_is_admin"());


--
-- Name: admin_notifications Admins can view notifications; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can view notifications" ON "public"."admin_notifications" FOR SELECT TO "authenticated" USING ("public"."is_admin"());


--
-- Name: order_timeline Admins can write order_timeline; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins can write order_timeline" ON "public"."order_timeline" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());


--
-- Name: cart_items Admins manage cart_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage cart_items" ON "public"."cart_items" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: carts Admins manage carts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage carts" ON "public"."carts" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: payment_providers Admins manage payment_providers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage payment_providers" ON "public"."payment_providers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: product_combinations Admins manage product combinations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage product combinations" ON "public"."product_combinations" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));


--
-- Name: product_categories Admins manage product_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage product_categories" ON "public"."product_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: promotions Admins manage promotions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage promotions" ON "public"."promotions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: shipping_options Admins manage shipping_options; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins manage shipping_options" ON "public"."shipping_options" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


--
-- Name: addresses Admins read all addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins read all addresses" ON "public"."addresses" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: reward_transactions Admins read all reward transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins read all reward transactions" ON "public"."reward_transactions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("wallet_id" IN ( SELECT "reward_wallets"."id"
   FROM "public"."reward_wallets"
  WHERE ("reward_wallets"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));


--
-- Name: reward_wallets Admins read all wallets; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Admins read all wallets" ON "public"."reward_wallets" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));


--
-- Name: products Allow public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access" ON "public"."products" FOR SELECT USING (true);


--
-- Name: product_combinations Allow public read access for product combinations; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access for product combinations" ON "public"."product_combinations" FOR SELECT USING (true);


--
-- Name: orders Customers can see their own orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Customers can see their own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: carts Guests access carts by ID; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Guests access carts by ID" ON "public"."carts" FOR SELECT TO "anon" USING (true);


--
-- Name: home_reviews Home reviews are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Home reviews are viewable by everyone" ON "public"."home_reviews" FOR SELECT USING (true);


--
-- Name: profiles Only users with customers:delete can delete customers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Only users with customers:delete can delete customers" ON "public"."profiles" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('customers:delete'::"text") AS "has_permission"));


--
-- Name: search_analytics Public can insert search_analytics; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can insert search_analytics" ON "public"."search_analytics" FOR INSERT WITH CHECK (true);


--
-- Name: global_settings Public can read global settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can read global settings" ON "public"."global_settings" FOR SELECT USING (true);


--
-- Name: home_exclusive_collections Public can view active exclusive collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view active exclusive collections" ON "public"."home_exclusive_collections" FOR SELECT USING (("is_active" = true));


--
-- Name: home_banners Public can view active home banners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view active home banners" ON "public"."home_banners" FOR SELECT USING ((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))));


--
-- Name: reviews Public can view approved reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view approved reviews" ON "public"."reviews" FOR SELECT USING (("approval_status" = 'approved'::"text"));


--
-- Name: review_media Public can view review media; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public can view review media" ON "public"."review_media" FOR SELECT USING (true);


--
-- Name: image Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."image" FOR SELECT USING (true);


--
-- Name: product_images Public read access; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read access" ON "public"."product_images" FOR SELECT USING (true);


--
-- Name: promotions Public read active promotions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read active promotions" ON "public"."promotions" FOR SELECT USING ((("is_active" = true) AND ("is_deleted" = false) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"()))));


--
-- Name: admin_roles Public read admin_roles; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read admin_roles" ON "public"."admin_roles" FOR SELECT USING (true);


--
-- Name: categories Public read categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read categories" ON "public"."categories" FOR SELECT USING (true);


--
-- Name: club_settings Public read club settings; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read club settings" ON "public"."club_settings" FOR SELECT USING (true);


--
-- Name: collections Public read collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read collections" ON "public"."collections" FOR SELECT USING (true);


--
-- Name: order_timeline Public read order_timeline; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read order_timeline" ON "public"."order_timeline" FOR SELECT USING (true);


--
-- Name: orders Public read orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read orders" ON "public"."orders" FOR SELECT USING (true);


--
-- Name: payment_providers Public read payment_providers; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read payment_providers" ON "public"."payment_providers" FOR SELECT USING (true);


--
-- Name: product_categories Public read product_categories; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read product_categories" ON "public"."product_categories" FOR SELECT USING (true);


--
-- Name: product_collections Public read product_collections; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read product_collections" ON "public"."product_collections" FOR SELECT USING (true);


--
-- Name: product_option_values Public read product_option_values; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read product_option_values" ON "public"."product_option_values" FOR SELECT USING (true);


--
-- Name: product_options Public read product_options; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read product_options" ON "public"."product_options" FOR SELECT USING (true);


--
-- Name: shipping_options Public read shipping_options; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read shipping_options" ON "public"."shipping_options" FOR SELECT USING (true);


--
-- Name: shipping_partners Public read shipping_partners; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read shipping_partners" ON "public"."shipping_partners" FOR SELECT USING (true);


--
-- Name: product_variants Public read variants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read variants" ON "public"."product_variants" FOR SELECT USING (true);


--
-- Name: cart_items Users access own cart_items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users access own cart_items" ON "public"."cart_items" TO "authenticated" USING (("cart_id" IN ( SELECT "carts"."id"
   FROM "public"."carts"
  WHERE ("carts"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("cart_id" IN ( SELECT "carts"."id"
   FROM "public"."carts"
  WHERE ("carts"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));


--
-- Name: carts Users access own carts; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users access own carts" ON "public"."carts" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: reward_transactions Users can create own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create own transactions" ON "public"."reward_transactions" FOR INSERT TO "authenticated" WITH CHECK (("wallet_id" IN ( SELECT "reward_wallets"."id"
   FROM "public"."reward_wallets"
  WHERE ("reward_wallets"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));


--
-- Name: reward_wallets Users can create own wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can create own wallet" ON "public"."reward_wallets" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses Users can delete their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can delete their own addresses" ON "public"."addresses" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses Users can insert their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can insert their own addresses" ON "public"."addresses" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: wishlist_items Users can manage their own wishlist items; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can manage their own wishlist items" ON "public"."wishlist_items" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: reward_wallets Users can update own wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update own wallet" ON "public"."reward_wallets" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses Users can update their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own addresses" ON "public"."addresses" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: addresses Users can view their own addresses; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own addresses" ON "public"."addresses" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: reviews Users can view their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view their own reviews" ON "public"."reviews" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));


--
-- Name: orders Users create own orders; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create own orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id" IS NULL)));


--
-- Name: reviews Users create their own reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users create their own reviews" ON "public"."reviews" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));


--
-- Name: reward_transactions Users read own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own transactions" ON "public"."reward_transactions" FOR SELECT TO "authenticated" USING (("wallet_id" IN ( SELECT "reward_wallets"."id"
   FROM "public"."reward_wallets"
  WHERE ("reward_wallets"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));


--
-- Name: reward_wallets Users read own wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users read own wallet" ON "public"."reward_wallets" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));


--
-- Name: review_media Users upload review media for their reviews; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users upload review media for their reviews" ON "public"."review_media" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."reviews"
  WHERE (("reviews"."id" = "review_media"."review_id") AND ("reviews"."user_id" = "auth"."uid"())))));


--
-- Name: addresses; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_notifications; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_roles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."admin_roles" ENABLE ROW LEVEL SECURITY;

--
-- Name: cart_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."cart_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: carts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."carts" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: club_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."club_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: collections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;

--
-- Name: global_settings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."global_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_banners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."home_banners" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_exclusive_collections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."home_exclusive_collections" ENABLE ROW LEVEL SECURITY;

--
-- Name: home_reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."home_reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: image; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."image" ENABLE ROW LEVEL SECURITY;

--
-- Name: order_timeline; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."order_timeline" ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;

--
-- Name: otp_codes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_providers; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."payment_providers" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_categories; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_collections; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_collections" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_combinations; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_combinations" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_images; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_images" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_option_values; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_option_values" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."product_variants" ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: promotions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."promotions" ENABLE ROW LEVEL SECURITY;

--
-- Name: review_media; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."review_media" ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reward_transactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."reward_wallets" ENABLE ROW LEVEL SECURITY;

--
-- Name: search_analytics; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."search_analytics" ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_options; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."shipping_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: shipping_partners; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."shipping_partners" ENABLE ROW LEVEL SECURITY;

--
-- Name: wishlist_items; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE "public"."wishlist_items" ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: postgres
--

-- CREATE PUBLICATION "supabase_realtime" WITH (publish = 'insert, update, delete, truncate');


ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

--
-- Name: supabase_realtime_messages_publication; Type: PUBLICATION; Schema: -; Owner: supabase_admin
--

-- CREATE PUBLICATION "supabase_realtime_messages_publication" WITH (publish = 'insert, update, delete, truncate');


-- ALTER PUBLICATION "supabase_realtime_messages_publication" OWNER TO "supabase_admin";

--
-- Name: supabase_realtime admin_notifications; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."admin_notifications";


--
-- Name: supabase_realtime orders; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";


--
-- Name: supabase_realtime wishlist_items; Type: PUBLICATION TABLE; Schema: public; Owner: postgres
--

ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."wishlist_items";


--
-- Name: SCHEMA "public"; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "postgres";


--
-- Name: FUNCTION "gtrgm_in"("cstring"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_in"("cstring") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_out"("extensions"."gtrgm"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_out"("extensions"."gtrgm") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_in"("cstring", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_in"("cstring", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_out"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_out"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_recv"("internal", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_recv"("internal", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_send"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_send"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_typmod_in"("cstring"[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_typmod_in"("cstring"[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_in"("cstring", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_in"("cstring", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_out"("extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_out"("extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_recv"("internal", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_recv"("internal", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_send"("extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_send"("extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_typmod_in"("cstring"[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_typmod_in"("cstring"[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_in"("cstring", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_in"("cstring", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_out"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_out"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_recv"("internal", "oid", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_recv"("internal", "oid", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_send"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_send"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_typmod_in"("cstring"[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_typmod_in"("cstring"[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_halfvec"(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_halfvec"(real[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_sparsevec"(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_sparsevec"(real[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_vector"(real[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_vector"(real[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_halfvec"(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_sparsevec"(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_vector"(double precision[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_vector"(double precision[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_halfvec"(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_halfvec"(integer[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_sparsevec"(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_vector"(integer[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_vector"(integer[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_halfvec"(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_sparsevec"(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "array_to_vector"(numeric[], integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."array_to_vector"(numeric[], integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_to_float4"("extensions"."halfvec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_to_float4"("extensions"."halfvec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec"("extensions"."halfvec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec"("extensions"."halfvec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_to_sparsevec"("extensions"."halfvec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_to_sparsevec"("extensions"."halfvec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_to_vector"("extensions"."halfvec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_to_vector"("extensions"."halfvec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_to_halfvec"("extensions"."sparsevec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_to_halfvec"("extensions"."sparsevec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec"("extensions"."sparsevec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec"("extensions"."sparsevec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_to_vector"("extensions"."sparsevec", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_to_vector"("extensions"."sparsevec", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_to_float4"("extensions"."vector", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_to_float4"("extensions"."vector", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_to_halfvec"("extensions"."vector", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_to_halfvec"("extensions"."vector", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_to_sparsevec"("extensions"."vector", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_to_sparsevec"("extensions"."vector", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector"("extensions"."vector", integer, boolean); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector"("extensions"."vector", integer, boolean) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "armor"("bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "armor"("bytea", "text"[], "text"[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."armor"("bytea", "text"[], "text"[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "binary_quantize"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."binary_quantize"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "binary_quantize"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."binary_quantize"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "cosine_distance"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."cosine_distance"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "cosine_distance"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."cosine_distance"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "cosine_distance"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."cosine_distance"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "crypt"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."crypt"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "dearmor"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."dearmor"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "decrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."decrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "digest"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."digest"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "digest"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."digest"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "encrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."encrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "encrypt_iv"("bytea", "bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."encrypt_iv"("bytea", "bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_random_bytes"(integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_random_bytes"(integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_random_uuid"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_random_uuid"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_salt"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gen_salt"("text", integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gen_salt"("text", integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_extract_value_trgm"("text", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_extract_value_trgm"("text", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_compress"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_compress"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_consistent"("internal", "text", smallint, "oid", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_decompress"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_decompress"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_distance"("internal", "text", smallint, "oid", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_options"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_options"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_penalty"("internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_picksplit"("internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_picksplit"("internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_same"("extensions"."gtrgm", "extensions"."gtrgm", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_same"("extensions"."gtrgm", "extensions"."gtrgm", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "gtrgm_union"("internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."gtrgm_union"("internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_accum"(double precision[], "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_accum"(double precision[], "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_add"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_add"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_avg"(double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_avg"(double precision[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_cmp"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_cmp"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_combine"(double precision[], double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_combine"(double precision[], double precision[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_concat"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_concat"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_eq"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_eq"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_ge"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_ge"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_gt"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_gt"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_l2_squared_distance"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_l2_squared_distance"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_le"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_le"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_lt"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_lt"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_mul"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_mul"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_ne"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_ne"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_negative_inner_product"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_negative_inner_product"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_spherical_distance"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_spherical_distance"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "halfvec_sub"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."halfvec_sub"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hamming_distance"(bit, bit); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hamming_distance"(bit, bit) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hmac"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hmac"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hmac"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hmac"("text", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hnsw_bit_support"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hnsw_bit_support"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hnsw_halfvec_support"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hnsw_halfvec_support"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hnsw_sparsevec_support"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hnsw_sparsevec_support"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hnswhandler"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hnswhandler"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg"(OUT "indexname" "text", OUT "indexrelid" "oid", OUT "indrelid" "oid", OUT "innatts" integer, OUT "indisunique" boolean, OUT "indkey" "int2vector", OUT "indcollation" "oidvector", OUT "indclass" "oidvector", OUT "indoption" "oidvector", OUT "indexprs" "pg_node_tree", OUT "indpred" "pg_node_tree", OUT "amid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg"(OUT "indexname" "text", OUT "indexrelid" "oid", OUT "indrelid" "oid", OUT "innatts" integer, OUT "indisunique" boolean, OUT "indkey" "int2vector", OUT "indcollation" "oidvector", OUT "indclass" "oidvector", OUT "indoption" "oidvector", OUT "indexprs" "pg_node_tree", OUT "indpred" "pg_node_tree", OUT "amid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_create_index"("sql_order" "text", OUT "indexrelid" "oid", OUT "indexname" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_create_index"("sql_order" "text", OUT "indexrelid" "oid", OUT "indexname" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_drop_index"("indexid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_drop_index"("indexid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_get_indexdef"("indexid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_get_indexdef"("indexid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_hidden_indexes"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_hidden_indexes"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_hide_index"("indexid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_hide_index"("indexid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_relation_size"("indexid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_relation_size"("indexid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_reset"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_reset"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_reset_index"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_reset_index"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_unhide_all_indexes"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_unhide_all_indexes"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "hypopg_unhide_index"("indexid" "oid"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."hypopg_unhide_index"("indexid" "oid") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "index_advisor"("query" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."index_advisor"("query" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "inner_product"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."inner_product"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "inner_product"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."inner_product"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "inner_product"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."inner_product"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "ivfflat_bit_support"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."ivfflat_bit_support"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "ivfflat_halfvec_support"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."ivfflat_halfvec_support"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "ivfflathandler"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."ivfflathandler"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "jaccard_distance"(bit, bit); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."jaccard_distance"(bit, bit) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l1_distance"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l1_distance"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l1_distance"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l1_distance"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l1_distance"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l1_distance"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_distance"("extensions"."halfvec", "extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_distance"("extensions"."halfvec", "extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_distance"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_distance"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_distance"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_distance"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_norm"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_norm"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_norm"("extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_norm"("extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_normalize"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_normalize"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_normalize"("extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_normalize"("extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "l2_normalize"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."l2_normalize"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements"("showtext" boolean, OUT "userid" "oid", OUT "dbid" "oid", OUT "toplevel" boolean, OUT "queryid" bigint, OUT "query" "text", OUT "plans" bigint, OUT "total_plan_time" double precision, OUT "min_plan_time" double precision, OUT "max_plan_time" double precision, OUT "mean_plan_time" double precision, OUT "stddev_plan_time" double precision, OUT "calls" bigint, OUT "total_exec_time" double precision, OUT "min_exec_time" double precision, OUT "max_exec_time" double precision, OUT "mean_exec_time" double precision, OUT "stddev_exec_time" double precision, OUT "rows" bigint, OUT "shared_blks_hit" bigint, OUT "shared_blks_read" bigint, OUT "shared_blks_dirtied" bigint, OUT "shared_blks_written" bigint, OUT "local_blks_hit" bigint, OUT "local_blks_read" bigint, OUT "local_blks_dirtied" bigint, OUT "local_blks_written" bigint, OUT "temp_blks_read" bigint, OUT "temp_blks_written" bigint, OUT "shared_blk_read_time" double precision, OUT "shared_blk_write_time" double precision, OUT "local_blk_read_time" double precision, OUT "local_blk_write_time" double precision, OUT "temp_blk_read_time" double precision, OUT "temp_blk_write_time" double precision, OUT "wal_records" bigint, OUT "wal_fpi" bigint, OUT "wal_bytes" numeric, OUT "jit_functions" bigint, OUT "jit_generation_time" double precision, OUT "jit_inlining_count" bigint, OUT "jit_inlining_time" double precision, OUT "jit_optimization_count" bigint, OUT "jit_optimization_time" double precision, OUT "jit_emission_count" bigint, OUT "jit_emission_time" double precision, OUT "jit_deform_count" bigint, OUT "jit_deform_time" double precision, OUT "stats_since" timestamp with time zone, OUT "minmax_stats_since" timestamp with time zone) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pg_stat_statements_info"(OUT "dealloc" bigint, OUT "stats_reset" timestamp with time zone) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_armor_headers"("text", OUT "key" "text", OUT "value" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_key_id"("bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_key_id"("bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_decrypt_bytea"("bytea", "bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt"("text", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt"("text", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_pub_encrypt_bytea"("bytea", "bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_pub_encrypt_bytea"("bytea", "bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_decrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_decrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt"("text", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt"("text", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "pgp_sym_encrypt_bytea"("bytea", "text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."pgp_sym_encrypt_bytea"("bytea", "text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "set_limit"(real); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."set_limit"(real) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "show_limit"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."show_limit"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "show_trgm"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."show_trgm"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity_dist"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity_dist"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_cmp"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_cmp"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_eq"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_eq"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_ge"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_ge"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_gt"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_gt"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_l2_squared_distance"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_l2_squared_distance"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_le"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_le"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_lt"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_lt"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_ne"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_ne"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sparsevec_negative_inner_product"("extensions"."sparsevec", "extensions"."sparsevec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sparsevec_negative_inner_product"("extensions"."sparsevec", "extensions"."sparsevec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_dist_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_dist_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_dist_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "strict_word_similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."strict_word_similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "subvector"("extensions"."halfvec", integer, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."subvector"("extensions"."halfvec", integer, integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "subvector"("extensions"."vector", integer, integer); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."subvector"("extensions"."vector", integer, integer) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "unaccent"("text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."unaccent"("text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "unaccent"("regdictionary", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."unaccent"("regdictionary", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "unaccent_init"("internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."unaccent_init"("internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "unaccent_lexize"("internal", "internal", "internal", "internal"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."unaccent_lexize"("internal", "internal", "internal", "internal") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v1"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v1mc"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v1mc"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v3"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v3"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v4"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v4"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_generate_v5"("namespace" "uuid", "name" "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_generate_v5"("namespace" "uuid", "name" "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_nil"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_nil"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_dns"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_dns"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_oid"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_oid"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_url"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_url"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "uuid_ns_x500"(); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."uuid_ns_x500"() TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_accum"(double precision[], "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_accum"(double precision[], "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_add"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_add"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_avg"(double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_avg"(double precision[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_cmp"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_cmp"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_combine"(double precision[], double precision[]); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_combine"(double precision[], double precision[]) TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_concat"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_concat"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_dims"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_dims"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_dims"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_dims"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_eq"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_eq"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_ge"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_ge"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_gt"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_gt"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_l2_squared_distance"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_l2_squared_distance"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_le"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_le"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_lt"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_lt"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_mul"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_mul"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_ne"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_ne"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_negative_inner_product"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_negative_inner_product"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_norm"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_norm"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_spherical_distance"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_spherical_distance"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "vector_sub"("extensions"."vector", "extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."vector_sub"("extensions"."vector", "extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_dist_commutator_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_dist_commutator_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_dist_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_dist_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "word_similarity_op"("text", "text"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."word_similarity_op"("text", "text") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "check_is_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_admin"() TO "service_role";


--
-- Name: FUNCTION "create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_order_with_payment"("p_cart_id" "text", "p_email" "text", "p_shipping_address" "jsonb", "p_billing_address" "jsonb", "p_payment_provider" "text", "p_rewards_to_apply" integer) TO "service_role";


--
-- Name: FUNCTION "handle_admin_notification"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_admin_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_admin_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_admin_notification"() TO "service_role";


--
-- Name: FUNCTION "handle_new_user"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";


--
-- Name: FUNCTION "handle_user_update"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_update"() TO "service_role";


--
-- Name: FUNCTION "has_permission"("required_permission" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("required_permission" "text") TO "service_role";


--
-- Name: FUNCTION "increment_promotion_uses"("promo_id" "text"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_promotion_uses"("promo_id" "text") TO "service_role";


--
-- Name: FUNCTION "is_admin"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";


--
-- Name: FUNCTION "match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer); Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
-- GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
-- GRANT ALL ON FUNCTION "public"."match_products"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";


--
-- Name: TABLE "categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";


--
-- Name: FUNCTION "parent_category"("public"."categories"); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "anon";
GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "authenticated";
GRANT ALL ON FUNCTION "public"."parent_category"("public"."categories") TO "service_role";


--
-- Name: FUNCTION "reorder_exclusive_collections"("collection_ids" "uuid"[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_exclusive_collections"("collection_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "reorder_home_banners"("banner_ids" "uuid"[]); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."reorder_home_banners"("banner_ids" "uuid"[]) TO "service_role";


--
-- Name: FUNCTION "search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_advanced"("search_query" "text", "similarity_threshold" double precision, "result_limit" integer) TO "service_role";


--
-- Name: FUNCTION "search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer); Type: ACL; Schema: public; Owner: postgres
--

-- GRANT ALL ON FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "anon";
-- GRANT ALL ON FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "authenticated";
-- GRANT ALL ON FUNCTION "public"."search_products_multimodal"("search_query" "text", "search_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer) TO "service_role";


--
-- Name: FUNCTION "track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_search_rpc"("p_query" "text", "p_type" "text", "p_results_count" integer, "p_user_id" "text", "p_session_id" "text", "p_duration_ms" integer) TO "service_role";


--
-- Name: FUNCTION "update_updated_at_column"(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


--
-- Name: FUNCTION "_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."_crypto_aead_det_decrypt"("message" "bytea", "additional" "bytea", "key_id" bigint, "context" "bytea", "nonce" "bytea") TO "service_role";


--
-- Name: FUNCTION "create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."create_secret"("new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid"); Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "postgres" WITH GRANT OPTION;
-- GRANT ALL ON FUNCTION "vault"."update_secret"("secret_id" "uuid", "new_secret" "text", "new_name" "text", "new_description" "text", "new_key_id" "uuid") TO "service_role";


--
-- Name: FUNCTION "avg"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."avg"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "avg"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."avg"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sum"("extensions"."halfvec"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sum"("extensions"."halfvec") TO "postgres" WITH GRANT OPTION;


--
-- Name: FUNCTION "sum"("extensions"."vector"); Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON FUNCTION "extensions"."sum"("extensions"."vector") TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "hypopg_list_indexes"; Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON TABLE "extensions"."hypopg_list_indexes" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "hypopg_hidden_indexes"; Type: ACL; Schema: extensions; Owner: supabase_admin
--

-- GRANT ALL ON TABLE "extensions"."hypopg_hidden_indexes" TO "postgres" WITH GRANT OPTION;


--
-- Name: TABLE "addresses"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";


--
-- Name: TABLE "admin_notifications"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";


--
-- Name: TABLE "admin_roles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."admin_roles" TO "anon";
GRANT ALL ON TABLE "public"."admin_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_roles" TO "service_role";


--
-- Name: TABLE "cart_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."cart_items" TO "anon";
GRANT ALL ON TABLE "public"."cart_items" TO "authenticated";
GRANT ALL ON TABLE "public"."cart_items" TO "service_role";


--
-- Name: TABLE "carts"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."carts" TO "anon";
GRANT ALL ON TABLE "public"."carts" TO "authenticated";
GRANT ALL ON TABLE "public"."carts" TO "service_role";


--
-- Name: TABLE "club_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."club_settings" TO "anon";
GRANT ALL ON TABLE "public"."club_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."club_settings" TO "service_role";


--
-- Name: TABLE "collections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";


--
-- Name: SEQUENCE "customer_display_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customer_display_id_seq" TO "service_role";


--
-- Name: TABLE "global_settings"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."global_settings" TO "anon";
GRANT ALL ON TABLE "public"."global_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."global_settings" TO "service_role";


--
-- Name: TABLE "home_banners"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."home_banners" TO "anon";
GRANT ALL ON TABLE "public"."home_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."home_banners" TO "service_role";


--
-- Name: TABLE "home_exclusive_collections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "anon";
GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."home_exclusive_collections" TO "service_role";


--
-- Name: TABLE "home_reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."home_reviews" TO "anon";
GRANT ALL ON TABLE "public"."home_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."home_reviews" TO "service_role";


--
-- Name: TABLE "image"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."image" TO "anon";
GRANT ALL ON TABLE "public"."image" TO "authenticated";
GRANT ALL ON TABLE "public"."image" TO "service_role";


--
-- Name: TABLE "order_timeline"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."order_timeline" TO "anon";
GRANT ALL ON TABLE "public"."order_timeline" TO "authenticated";
GRANT ALL ON TABLE "public"."order_timeline" TO "service_role";


--
-- Name: TABLE "orders"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";


--
-- Name: SEQUENCE "orders_display_id_seq"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."orders_display_id_seq" TO "service_role";


--
-- Name: TABLE "otp_codes"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."otp_codes" TO "anon";
GRANT ALL ON TABLE "public"."otp_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."otp_codes" TO "service_role";


--
-- Name: TABLE "payment_providers"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."payment_providers" TO "anon";
GRANT ALL ON TABLE "public"."payment_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_providers" TO "service_role";


--
-- Name: TABLE "product_categories"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";


--
-- Name: TABLE "product_collections"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_collections" TO "anon";
GRANT ALL ON TABLE "public"."product_collections" TO "authenticated";
GRANT ALL ON TABLE "public"."product_collections" TO "service_role";


--
-- Name: TABLE "product_combinations"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_combinations" TO "anon";
GRANT ALL ON TABLE "public"."product_combinations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_combinations" TO "service_role";


--
-- Name: TABLE "product_images"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_images" TO "anon";
GRANT ALL ON TABLE "public"."product_images" TO "authenticated";
GRANT ALL ON TABLE "public"."product_images" TO "service_role";


--
-- Name: TABLE "product_option_values"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_option_values" TO "anon";
GRANT ALL ON TABLE "public"."product_option_values" TO "authenticated";
GRANT ALL ON TABLE "public"."product_option_values" TO "service_role";


--
-- Name: TABLE "product_options"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_options" TO "anon";
GRANT ALL ON TABLE "public"."product_options" TO "authenticated";
GRANT ALL ON TABLE "public"."product_options" TO "service_role";


--
-- Name: TABLE "product_variants"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."product_variants" TO "anon";
GRANT ALL ON TABLE "public"."product_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."product_variants" TO "service_role";


--
-- Name: TABLE "products"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";


--
-- Name: TABLE "profiles"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";


--
-- Name: TABLE "promotions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."promotions" TO "anon";
GRANT ALL ON TABLE "public"."promotions" TO "authenticated";
GRANT ALL ON TABLE "public"."promotions" TO "service_role";


--
-- Name: TABLE "review_media"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."review_media" TO "anon";
GRANT ALL ON TABLE "public"."review_media" TO "authenticated";
GRANT ALL ON TABLE "public"."review_media" TO "service_role";


--
-- Name: TABLE "reviews"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";


--
-- Name: TABLE "reward_transactions"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reward_transactions" TO "anon";
GRANT ALL ON TABLE "public"."reward_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_transactions" TO "service_role";


--
-- Name: TABLE "reward_wallets"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."reward_wallets" TO "anon";
GRANT ALL ON TABLE "public"."reward_wallets" TO "authenticated";
GRANT ALL ON TABLE "public"."reward_wallets" TO "service_role";


--
-- Name: TABLE "search_analytics"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."search_analytics" TO "anon";
GRANT ALL ON TABLE "public"."search_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."search_analytics" TO "service_role";


--
-- Name: TABLE "shipping_options"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."shipping_options" TO "anon";
GRANT ALL ON TABLE "public"."shipping_options" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_options" TO "service_role";


--
-- Name: TABLE "shipping_partners"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."shipping_partners" TO "anon";
GRANT ALL ON TABLE "public"."shipping_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."shipping_partners" TO "service_role";


--
-- Name: TABLE "wishlist_items"; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE "public"."wishlist_items" TO "anon";
GRANT ALL ON TABLE "public"."wishlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."wishlist_items" TO "service_role";


--
-- Name: TABLE "secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."secrets" TO "service_role";


--
-- Name: TABLE "decrypted_secrets"; Type: ACL; Schema: vault; Owner: supabase_admin
--

-- GRANT SELECT,REFERENCES,DELETE,TRUNCATE ON TABLE "vault"."decrypted_secrets" TO "postgres" WITH GRANT OPTION;
-- GRANT SELECT,DELETE ON TABLE "vault"."decrypted_secrets" TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_graphql_placeholder" ON "sql_drop"
--          WHEN TAG IN ('DROP EXTENSION')
--    EXECUTE FUNCTION "extensions"."set_graphql_placeholder"();


-- ALTER EVENT TRIGGER "issue_graphql_placeholder" OWNER TO "supabase_admin";

--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_cron_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_cron_access"();


-- ALTER EVENT TRIGGER "issue_pg_cron_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_graphql_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE FUNCTION')
--    EXECUTE FUNCTION "extensions"."grant_pg_graphql_access"();


-- ALTER EVENT TRIGGER "issue_pg_graphql_access" OWNER TO "supabase_admin";

--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "issue_pg_net_access" ON "ddl_command_end"
--          WHEN TAG IN ('CREATE EXTENSION')
--    EXECUTE FUNCTION "extensions"."grant_pg_net_access"();


-- ALTER EVENT TRIGGER "issue_pg_net_access" OWNER TO "supabase_admin";

--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_ddl_watch" ON "ddl_command_end"
--    EXECUTE FUNCTION "extensions"."pgrst_ddl_watch"();


-- ALTER EVENT TRIGGER "pgrst_ddl_watch" OWNER TO "supabase_admin";

--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: supabase_admin
--

-- CREATE EVENT TRIGGER "pgrst_drop_watch" ON "sql_drop"
--    EXECUTE FUNCTION "extensions"."pgrst_drop_watch"();


-- ALTER EVENT TRIGGER "pgrst_drop_watch" OWNER TO "supabase_admin";

--
-- PostgreSQL database dump complete
--

-- \unrestrict GuiSbCUjydD7TLUKsIyfIizP0iIPmkHwas3DJuUZG9XqBnfDLflQjMRakFNgIV2


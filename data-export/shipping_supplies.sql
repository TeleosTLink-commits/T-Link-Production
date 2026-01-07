--
-- PostgreSQL database dump
--

\restrict Pfepzdn4uwm9GPhRyXzZzwr798GowJpJRcqiIETNjYjmfxWKbxx6gjrVWVapcAX

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: shipping_supplies; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('9a455840-5e74-4a49-83d2-9e1fd35a9981', '4GV/X 4.0/S/25', 'Metal Can', '9168', 'KHMS-66340', 'LabelMaster', '$44.35', 20, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');
INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('549c20bf-7d90-42e5-86e3-51e8ba5c5296', '4GV/X 2.9/S/23', 'Plastic Capsulock', '21488', 'UNIPCAPSULOCSP-32-R2', 'LabelMaster', '$29.22', 10, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');
INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('72110423-23b3-4a99-9ea4-260a9dc7399c', '4GV/X 2.9/S/23', 'Plastic Capsulock', 'NA', 'NA', 'NA', 'NA', 2, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');
INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('f0f0889d-dae0-4ba3-97c8-b2656cf9949b', '4GV/X 8.9/S/25', 'Cardboard Capsule', 'NA', 'NA', 'NA', 'NA', 5, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');
INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('0da7635b-9b82-4ada-ab8c-987f34f291c7', '4GV/X 10/S/25', 'Cardboard 4 Partition', 'NA', 'S-22147', 'ULINE', '$61 for 15', 2, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');
INSERT INTO public.shipping_supplies (id, un_box_type, inner_packing_type, dot_sp_number, item_number, purchased_from, price_per_unit, count, created_at, updated_at) VALUES ('5c0ca38d-a7c0-4cb7-838a-feba43a5effd', '4GV/X 3.1/S/24', 'Cardboard', 'NA', 'NA', 'NA', 'NA', 4, '2026-01-05 16:08:57.136037', '2026-01-05 16:08:57.136037');


--
-- PostgreSQL database dump complete
--

\unrestrict Pfepzdn4uwm9GPhRyXzZzwr798GowJpJRcqiIETNjYjmfxWKbxx6gjrVWVapcAX


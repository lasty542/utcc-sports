--
-- PostgreSQL database dump
--

\restrict X7Znw1iiAoYxOxcmURNQMQJ1aRAbpbJPavN9zNsnlorbn3pSlF6bknIv5HLFgA1

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: borrow_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.borrow_requests (
    id integer NOT NULL,
    user_id integer,
    equipment_id integer,
    quantity integer DEFAULT 1 NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying,
    due_date timestamp without time zone NOT NULL,
    totp_code character varying(10),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT borrow_requests_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'borrowed'::character varying, 'returned'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: borrow_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.borrow_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: borrow_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.borrow_requests_id_seq OWNED BY public.borrow_requests.id;


--
-- Name: borrows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.borrows (
    id integer NOT NULL,
    user_id integer NOT NULL,
    equipment_id integer NOT NULL,
    quantity integer NOT NULL,
    purpose text,
    borrow_date date NOT NULL,
    due_date date NOT NULL,
    status character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT borrows_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT borrows_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'borrowing'::character varying, 'returned'::character varying])::text[])))
);


--
-- Name: borrows_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.borrows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: borrows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.borrows_id_seq OWNED BY public.borrows.id;


--
-- Name: equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.equipment (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    description text,
    total_qty integer NOT NULL,
    available_qty integer NOT NULL,
    image text,
    icon character varying(100),
    status character varying(50) DEFAULT 'พร้อมใช้งาน'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_available_lte_total CHECK ((available_qty <= total_qty)),
    CONSTRAINT equipment_available_qty_check CHECK ((available_qty >= 0)),
    CONSTRAINT equipment_total_qty_check CHECK ((total_qty >= 0))
);


--
-- Name: equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.equipment_id_seq OWNED BY public.equipment.id;


--
-- Name: sports_equipment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sports_equipment (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    category character varying(100) NOT NULL,
    total_qty integer DEFAULT 0 NOT NULL,
    available_qty integer DEFAULT 0 NOT NULL,
    image_url text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: sports_equipment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sports_equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sports_equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sports_equipment_id_seq OWNED BY public.sports_equipment.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    student_id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    password character varying(255),
    password_hash character varying(255),
    email character varying(100),
    role character varying(20) DEFAULT 'student'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    phone character varying(30),
    otp_secret text,
    otp_enabled boolean DEFAULT false NOT NULL,
    auth_provider character varying(32) DEFAULT 'local'::character varying NOT NULL,
    reset_token_hash text,
    reset_token_expires timestamp with time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['student'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: borrow_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests ALTER COLUMN id SET DEFAULT nextval('public.borrow_requests_id_seq'::regclass);


--
-- Name: borrows id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrows ALTER COLUMN id SET DEFAULT nextval('public.borrows_id_seq'::regclass);


--
-- Name: equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment ALTER COLUMN id SET DEFAULT nextval('public.equipment_id_seq'::regclass);


--
-- Name: sports_equipment id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports_equipment ALTER COLUMN id SET DEFAULT nextval('public.sports_equipment_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: borrow_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.borrow_requests (id, user_id, equipment_id, quantity, status, due_date, totp_code, created_at) FROM stdin;
\.


--
-- Data for Name: borrows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.borrows (id, user_id, equipment_id, quantity, purpose, borrow_date, due_date, status, created_at) FROM stdin;
1	2	5	1	เล่นกีฬา [รอบเช้า (09:00-12:00)]	2026-11-11	2026-11-12	returned	2026-11-11 14:43:59.021067+07
2	2	4	1	เล่น [รอบเช้า (09:00-12:00)]	2026-11-11	2026-11-12	pending	2026-11-11 15:15:33.299754+07
3	8	4	2	เล่นกีฬา / ออกกำลังกาย [รอบเช้า (09:00-12:00)]	2026-11-11	2026-11-12	pending	2026-11-11 15:55:33.922182+07
6	8	5	1	เล่นกีฬา / ออกกำลังกาย [รอบเช้า (09:00-12:00)]	2026-11-21	2026-11-22	borrowing	2026-11-21 14:00:02.379195+07
5	8	5	1	เล่นกีฬา / ออกกำลังกาย [รอบเช้า (09:00-12:00)]	2026-11-11	2026-11-12	returned	2026-11-11 16:00:24.753594+07
4	8	2	4	เล่นกีฬา / ออกกำลังกาย [รอบเช้า (09:00-12:00)]	2026-11-11	2026-11-12	returned	2026-11-11 15:58:37.319991+07
7	8	5	1	ฝึกซ้อมชมรมกีฬา [รอบบ่าย (13:00-17:00)]	2026-11-21	2026-11-22	pending	2026-11-21 14:03:23.015844+07
8	8	2	1	กิจกรรมคณะ / แข่งขัน [รอบเช้า (09:00-12:00)]	2026-11-21	2026-11-28	borrowing	2026-11-21 14:04:01.016262+07
\.


--
-- Data for Name: equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.equipment (id, name, category, description, total_qty, available_qty, image, icon, status, created_at) FROM stdin;
1	ลูกฟุตบอล Molten No.5	ฟุตบอล	ลูกบอลหนังมาตรฐาน สำหรับใช้สนามหญ้าและสนามปูน	10	10	https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop	\N	พร้อมใช้งาน	2026-11-11 14:43:27.775643+07
3	ลูกวอลเลย์บอล Mikasa	วอลเลย์บอล	ลูกวอลเลย์บอลผิวสัมผัสนุ่ม ลดแรงกระแทกแขน	6	6	https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?q=80&w=600&auto=format&fit=crop	\N	พร้อมใช้งาน	2026-11-11 14:43:27.775643+07
5	ชุดไม้ปิงปอง Butterfly (2 ไม้ + 3 ลูก)	เทเบิลเทนนิส	\N	20	8	\N	\N	ใช้งานอยู่	2026-11-11 14:43:27.775643+07
2	ลูกบาสเกตบอล Spalding	บาสเกตบอล	ลูกบาสเกตบอลยางกันกระแทกอย่างดี สำหรับสนามกลางแจ้งและในร่ม	8	7	https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop	\N	ใช้งานอยู่	2026-11-11 14:43:27.775643+07
4	ชุดไม้แบดมินตัน Yonex (2 ไม้ + ลูก)	แบดมินตัน	ไม้แบดมินตันพร้อมลูกขนไก่ 1 ชุดประกอบด้วยไม้ 2 อัน	12	9	https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600&auto=format&fit=crop	\N	ใช้งานอยู่	2026-11-11 14:43:27.775643+07
\.


--
-- Data for Name: sports_equipment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sports_equipment (id, name, category, total_qty, available_qty, image_url, created_at) FROM stdin;
1	ลูกบาสเกตบอล Molten GG7X	บาสเกตบอล	10	8	https://images.unsplash.com/photo-1519861531473-9200262188bf?w=500	2026-11-11 14:20:26.331376
2	ไม้แบดมินตัน Yonex Nanoflare	แบดมินตัน	15	12	https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=500	2026-11-11 14:20:26.331376
3	ลูกฟุตบอล Mikasa FIFA	ฟุตบอล	8	0	https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=500	2026-11-11 14:20:26.331376
4	ลูกวอลเลย์บอล Mikasa V200W	วอลเลย์บอล	12	5	https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=500	2026-11-11 14:20:26.331376
5	ไม้ปิงปอง Butterfly พร้อมลูก	เทเบิลเทนนิส	10	10	https://images.unsplash.com/photo-1534158914592-062992fbe900?w=500	2026-11-11 14:20:26.331376
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, student_id, name, password, password_hash, email, role, created_at, phone, otp_secret, otp_enabled, auth_provider, reset_token_hash, reset_token_expires) FROM stdin;
3	6500000000001	นักศึกษา ตัวอย่าง	123456	$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW	student01@utcc.ac.th	student	2026-11-11 14:20:26.331376	0812345678	\N	f	local	\N	\N
19	google-demo-user	Google Student (Demo)	\N	$2b$10$cpo4vECQ990jXHA5XcLt..IlPAhkcyt2xKkr07lTl3AlfKQrI8.Sy	demo.student@gmail.com	student	2026-11-22 10:16:32.35326	\N	\N	f	google	\N	\N
22	go-f1e465a9f5	lazraizo	\N	$2b$10$jWAfuetX1YkGKMry/E3LfuW4y4l2z1HTXjg20mJCsrFMvqov.B.pW	llxsvegas@gmail.com	student	2026-11-22 10:34:53.278206	\N	\N	f	google	\N	\N
9	admin	เจ้าหน้าที่ผู้ดูแลระบบ	\N	$2b$10$WyNeOWPmygZQKuczz/3rr.QsP.ua4oUKTgAI8rfiu7.M7Mr1lcnue	admin@utcc.ac.th	admin	2026-11-11 15:51:09.965782	\N	\N	f	local	\N	\N
8	2410511101055	ซาลาส มูฮำมัดตอเฮต	\N	$2b$10$Bk4N2Ff7DxVjMh7mVeshNea0tav6xzMAXjD0TVwILzdgKtYc2LBiG	2410511101055@utcc.ac.th	student	2026-11-11 15:45:24.96946	\N	\N	f	microsoft	\N	\N
\.


--
-- Name: borrow_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.borrow_requests_id_seq', 1, false);


--
-- Name: borrows_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.borrows_id_seq', 8, true);


--
-- Name: equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.equipment_id_seq', 5, true);


--
-- Name: sports_equipment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sports_equipment_id_seq', 5, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 40, true);


--
-- Name: borrow_requests borrow_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_pkey PRIMARY KEY (id);


--
-- Name: borrows borrows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrows
    ADD CONSTRAINT borrows_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: sports_equipment sports_equipment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sports_equipment
    ADD CONSTRAINT sports_equipment_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_student_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_student_id_key UNIQUE (student_id);


--
-- Name: idx_borrows_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_borrows_status ON public.borrows USING btree (status);


--
-- Name: idx_borrows_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_borrows_user_id ON public.borrows USING btree (user_id);


--
-- Name: idx_equipment_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_equipment_category ON public.equipment USING btree (category);


--
-- Name: idx_users_email_lower; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email_lower ON public.users USING btree (lower((email)::text));


--
-- Name: borrow_requests borrow_requests_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.sports_equipment(id) ON DELETE CASCADE;


--
-- Name: borrow_requests borrow_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrow_requests
    ADD CONSTRAINT borrow_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: borrows borrows_equipment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.borrows
    ADD CONSTRAINT borrows_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES public.equipment(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict X7Znw1iiAoYxOxcmURNQMQJ1aRAbpbJPavN9zNsnlorbn3pSlF6bknIv5HLFgA1


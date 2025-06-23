--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Debian 17.5-1.pgdg120+1)
-- Dumped by pg_dump version 17.5 (Debian 17.5-1.pgdg120+1)

-- Started on 2025-06-23 21:46:12 UTC

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
-- TOC entry 243 (class 1259 OID 16604)
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer,
    patient_id integer,
    action character varying NOT NULL,
    entity_type character varying NOT NULL,
    entity_id integer,
    description text NOT NULL,
    event_metadata json,
    "timestamp" timestamp without time zone NOT NULL,
    ip_address character varying,
    user_agent character varying
);


ALTER TABLE public.activity_logs OWNER TO "user";

--
-- TOC entry 242 (class 1259 OID 16603)
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO "user";

--
-- TOC entry 3555 (class 0 OID 0)
-- Dependencies: 242
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- TOC entry 217 (class 1259 OID 16385)
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO "user";

--
-- TOC entry 237 (class 1259 OID 16550)
-- Name: allergies; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.allergies (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    allergen character varying NOT NULL,
    reaction character varying NOT NULL,
    severity character varying,
    onset_date date,
    status character varying,
    notes character varying
);


ALTER TABLE public.allergies OWNER TO "user";

--
-- TOC entry 236 (class 1259 OID 16549)
-- Name: allergies_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.allergies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allergies_id_seq OWNER TO "user";

--
-- TOC entry 3556 (class 0 OID 0)
-- Dependencies: 236
-- Name: allergies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.allergies_id_seq OWNED BY public.allergies.id;


--
-- TOC entry 249 (class 1259 OID 16673)
-- Name: backup_records; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.backup_records (
    id integer NOT NULL,
    backup_type character varying NOT NULL,
    status character varying NOT NULL,
    file_path character varying NOT NULL,
    created_at timestamp without time zone NOT NULL,
    size_bytes integer,
    description text,
    compression_used boolean NOT NULL,
    checksum character varying
);


ALTER TABLE public.backup_records OWNER TO "user";

--
-- TOC entry 248 (class 1259 OID 16672)
-- Name: backup_records_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.backup_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.backup_records_id_seq OWNER TO "user";

--
-- TOC entry 3557 (class 0 OID 0)
-- Dependencies: 248
-- Name: backup_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.backup_records_id_seq OWNED BY public.backup_records.id;


--
-- TOC entry 231 (class 1259 OID 16493)
-- Name: conditions; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.conditions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    practitioner_id integer,
    condition_name character varying,
    diagnosis character varying NOT NULL,
    notes character varying,
    "onsetDate" date,
    status character varying NOT NULL
);


ALTER TABLE public.conditions OWNER TO "user";

--
-- TOC entry 230 (class 1259 OID 16492)
-- Name: conditions_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.conditions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.conditions_id_seq OWNER TO "user";

--
-- TOC entry 3558 (class 0 OID 0)
-- Dependencies: 230
-- Name: conditions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.conditions_id_seq OWNED BY public.conditions.id;


--
-- TOC entry 227 (class 1259 OID 16455)
-- Name: encounters; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.encounters (
    id integer NOT NULL,
    patient_id integer,
    practitioner_id integer,
    reason character varying NOT NULL,
    date date NOT NULL,
    notes character varying
);


ALTER TABLE public.encounters OWNER TO "user";

--
-- TOC entry 226 (class 1259 OID 16454)
-- Name: encounters_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.encounters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.encounters_id_seq OWNER TO "user";

--
-- TOC entry 3559 (class 0 OID 0)
-- Dependencies: 226
-- Name: encounters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.encounters_id_seq OWNED BY public.encounters.id;


--
-- TOC entry 233 (class 1259 OID 16512)
-- Name: immunizations; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.immunizations (
    id integer NOT NULL,
    patient_id integer,
    practitioner_id integer,
    vaccine_name character varying NOT NULL,
    date_administered date NOT NULL,
    dose_number integer,
    lot_number character varying,
    manufacturer character varying,
    site character varying,
    route character varying,
    expiration_date date,
    notes text
);


ALTER TABLE public.immunizations OWNER TO "user";

--
-- TOC entry 232 (class 1259 OID 16511)
-- Name: immunizations_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.immunizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.immunizations_id_seq OWNER TO "user";

--
-- TOC entry 3560 (class 0 OID 0)
-- Dependencies: 232
-- Name: immunizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.immunizations_id_seq OWNED BY public.immunizations.id;


--
-- TOC entry 239 (class 1259 OID 16564)
-- Name: lab_result_files; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.lab_result_files (
    id integer NOT NULL,
    lab_result_id integer,
    file_name character varying NOT NULL,
    file_path character varying NOT NULL,
    file_type character varying NOT NULL,
    file_size integer,
    description character varying,
    uploaded_at timestamp without time zone NOT NULL
);


ALTER TABLE public.lab_result_files OWNER TO "user";

--
-- TOC entry 238 (class 1259 OID 16563)
-- Name: lab_result_files_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.lab_result_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_result_files_id_seq OWNER TO "user";

--
-- TOC entry 3561 (class 0 OID 0)
-- Dependencies: 238
-- Name: lab_result_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.lab_result_files_id_seq OWNED BY public.lab_result_files.id;


--
-- TOC entry 229 (class 1259 OID 16474)
-- Name: lab_results; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.lab_results (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    practitioner_id integer,
    test_name character varying NOT NULL,
    test_code character varying,
    test_category character varying,
    test_type character varying,
    facility character varying,
    status character varying NOT NULL,
    ordered_date timestamp without time zone NOT NULL,
    completed_date timestamp without time zone,
    notes text,
    created_at timestamp without time zone,
    updated_at timestamp without time zone,
    labs_result character varying
);


ALTER TABLE public.lab_results OWNER TO "user";

--
-- TOC entry 228 (class 1259 OID 16473)
-- Name: lab_results_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.lab_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.lab_results_id_seq OWNER TO "user";

--
-- TOC entry 3562 (class 0 OID 0)
-- Dependencies: 228
-- Name: lab_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.lab_results_id_seq OWNED BY public.lab_results.id;


--
-- TOC entry 225 (class 1259 OID 16436)
-- Name: medications; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.medications (
    id integer NOT NULL,
    medication_name character varying NOT NULL,
    dosage character varying,
    frequency character varying,
    route character varying,
    indication character varying,
    "effectivePeriod_start" date,
    "effectivePeriod_end" date,
    status character varying,
    patient_id integer NOT NULL,
    practitioner_id integer,
    pharmacy_id integer
);


ALTER TABLE public.medications OWNER TO "user";

--
-- TOC entry 224 (class 1259 OID 16435)
-- Name: medications_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.medications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.medications_id_seq OWNER TO "user";

--
-- TOC entry 3563 (class 0 OID 0)
-- Dependencies: 224
-- Name: medications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.medications_id_seq OWNED BY public.medications.id;


--
-- TOC entry 223 (class 1259 OID 16417)
-- Name: patients; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.patients (
    id integer NOT NULL,
    user_id integer NOT NULL,
    first_name character varying NOT NULL,
    last_name character varying NOT NULL,
    "birthDate" date NOT NULL,
    physician_id integer,
    "bloodType" character varying,
    height integer,
    weight integer,
    gender character varying,
    address character varying
);


ALTER TABLE public.patients OWNER TO "user";

--
-- TOC entry 222 (class 1259 OID 16416)
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.patients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.patients_id_seq OWNER TO "user";

--
-- TOC entry 3564 (class 0 OID 0)
-- Dependencies: 222
-- Name: patients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.patients_id_seq OWNED BY public.patients.id;


--
-- TOC entry 247 (class 1259 OID 16647)
-- Name: pharmacies; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.pharmacies (
    id integer NOT NULL,
    name character varying NOT NULL,
    phone_number character varying,
    email character varying,
    website character varying,
    brand character varying,
    street_address character varying,
    city character varying,
    state character varying,
    zip_code character varying,
    country character varying,
    store_number character varying,
    fax_number character varying,
    hours character varying,
    drive_through boolean,
    twenty_four_hour boolean,
    specialty_services character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.pharmacies OWNER TO "user";

--
-- TOC entry 246 (class 1259 OID 16646)
-- Name: pharmacies_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.pharmacies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pharmacies_id_seq OWNER TO "user";

--
-- TOC entry 3565 (class 0 OID 0)
-- Dependencies: 246
-- Name: pharmacies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.pharmacies_id_seq OWNED BY public.pharmacies.id;


--
-- TOC entry 221 (class 1259 OID 16408)
-- Name: practitioners; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.practitioners (
    id integer NOT NULL,
    name character varying NOT NULL,
    specialty character varying NOT NULL,
    practice character varying NOT NULL,
    phone_number character varying,
    website character varying,
    rating double precision
);


ALTER TABLE public.practitioners OWNER TO "user";

--
-- TOC entry 220 (class 1259 OID 16407)
-- Name: practitioners_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.practitioners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.practitioners_id_seq OWNER TO "user";

--
-- TOC entry 3566 (class 0 OID 0)
-- Dependencies: 220
-- Name: practitioners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.practitioners_id_seq OWNED BY public.practitioners.id;


--
-- TOC entry 235 (class 1259 OID 16531)
-- Name: procedures; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.procedures (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    practitioner_id integer,
    procedure_name character varying NOT NULL,
    code character varying,
    date date NOT NULL,
    description character varying,
    status character varying,
    notes character varying,
    facility character varying
);


ALTER TABLE public.procedures OWNER TO "user";

--
-- TOC entry 234 (class 1259 OID 16530)
-- Name: procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.procedures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.procedures_id_seq OWNER TO "user";

--
-- TOC entry 3567 (class 0 OID 0)
-- Dependencies: 234
-- Name: procedures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.procedures_id_seq OWNED BY public.procedures.id;


--
-- TOC entry 241 (class 1259 OID 16578)
-- Name: treatments; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.treatments (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    practitioner_id integer,
    condition_id integer,
    treatment_name character varying NOT NULL,
    treatment_type character varying NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying,
    treatment_category character varying,
    notes character varying,
    frequency character varying,
    outcome character varying,
    description character varying,
    location character varying
);


ALTER TABLE public.treatments OWNER TO "user";

--
-- TOC entry 240 (class 1259 OID 16577)
-- Name: treatments_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.treatments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.treatments_id_seq OWNER TO "user";

--
-- TOC entry 3568 (class 0 OID 0)
-- Dependencies: 240
-- Name: treatments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.treatments_id_seq OWNED BY public.treatments.id;


--
-- TOC entry 219 (class 1259 OID 16395)
-- Name: users; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying NOT NULL,
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    full_name character varying NOT NULL,
    role character varying NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO "user";

--
-- TOC entry 218 (class 1259 OID 16394)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO "user";

--
-- TOC entry 3569 (class 0 OID 0)
-- Dependencies: 218
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 245 (class 1259 OID 16628)
-- Name: vitals; Type: TABLE; Schema: public; Owner: user
--

CREATE TABLE public.vitals (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    practitioner_id integer,
    recorded_date timestamp without time zone NOT NULL,
    systolic_bp integer,
    diastolic_bp integer,
    heart_rate integer,
    temperature double precision,
    weight double precision,
    height double precision,
    oxygen_saturation double precision,
    respiratory_rate integer,
    blood_glucose double precision,
    bmi double precision,
    pain_scale integer,
    notes text,
    location character varying,
    device_used character varying,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.vitals OWNER TO "user";

--
-- TOC entry 244 (class 1259 OID 16627)
-- Name: vitals_id_seq; Type: SEQUENCE; Schema: public; Owner: user
--

CREATE SEQUENCE public.vitals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vitals_id_seq OWNER TO "user";

--
-- TOC entry 3570 (class 0 OID 0)
-- Dependencies: 244
-- Name: vitals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: user
--

ALTER SEQUENCE public.vitals_id_seq OWNED BY public.vitals.id;


--
-- TOC entry 3301 (class 2604 OID 16607)
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- TOC entry 3298 (class 2604 OID 16553)
-- Name: allergies id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.allergies ALTER COLUMN id SET DEFAULT nextval('public.allergies_id_seq'::regclass);


--
-- TOC entry 3304 (class 2604 OID 16676)
-- Name: backup_records id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.backup_records ALTER COLUMN id SET DEFAULT nextval('public.backup_records_id_seq'::regclass);


--
-- TOC entry 3295 (class 2604 OID 16496)
-- Name: conditions id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.conditions ALTER COLUMN id SET DEFAULT nextval('public.conditions_id_seq'::regclass);


--
-- TOC entry 3293 (class 2604 OID 16458)
-- Name: encounters id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.encounters ALTER COLUMN id SET DEFAULT nextval('public.encounters_id_seq'::regclass);


--
-- TOC entry 3296 (class 2604 OID 16515)
-- Name: immunizations id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.immunizations ALTER COLUMN id SET DEFAULT nextval('public.immunizations_id_seq'::regclass);


--
-- TOC entry 3299 (class 2604 OID 16567)
-- Name: lab_result_files id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_result_files ALTER COLUMN id SET DEFAULT nextval('public.lab_result_files_id_seq'::regclass);


--
-- TOC entry 3294 (class 2604 OID 16477)
-- Name: lab_results id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_results ALTER COLUMN id SET DEFAULT nextval('public.lab_results_id_seq'::regclass);


--
-- TOC entry 3292 (class 2604 OID 16439)
-- Name: medications id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.medications ALTER COLUMN id SET DEFAULT nextval('public.medications_id_seq'::regclass);


--
-- TOC entry 3291 (class 2604 OID 16420)
-- Name: patients id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.patients ALTER COLUMN id SET DEFAULT nextval('public.patients_id_seq'::regclass);


--
-- TOC entry 3303 (class 2604 OID 16650)
-- Name: pharmacies id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pharmacies ALTER COLUMN id SET DEFAULT nextval('public.pharmacies_id_seq'::regclass);


--
-- TOC entry 3290 (class 2604 OID 16411)
-- Name: practitioners id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.practitioners ALTER COLUMN id SET DEFAULT nextval('public.practitioners_id_seq'::regclass);


--
-- TOC entry 3297 (class 2604 OID 16534)
-- Name: procedures id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.procedures ALTER COLUMN id SET DEFAULT nextval('public.procedures_id_seq'::regclass);


--
-- TOC entry 3300 (class 2604 OID 16581)
-- Name: treatments id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.treatments ALTER COLUMN id SET DEFAULT nextval('public.treatments_id_seq'::regclass);


--
-- TOC entry 3289 (class 2604 OID 16398)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3302 (class 2604 OID 16631)
-- Name: vitals id; Type: DEFAULT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.vitals ALTER COLUMN id SET DEFAULT nextval('public.vitals_id_seq'::regclass);


--
-- TOC entry 3543 (class 0 OID 16604)
-- Dependencies: 243
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.activity_logs (id, user_id, patient_id, action, entity_type, entity_id, description, event_metadata, "timestamp", ip_address, user_agent) FROM stdin;
1	1	\N	created	medication	1	New medication: Testing 5 for Admin User	\N	2025-06-19 12:08:22.781707	\N	\N
2	1	\N	created	medication	2	New medication: cxccxz for Admin User	\N	2025-06-19 12:03:22.781811	\N	\N
3	1	\N	deleted	medication	99	Deleted medication: Test Drug for Patient John Doe	\N	2025-06-19 12:11:22.781905	\N	\N
4	1	\N	updated	medication	1	Updated medication: Testing 5 for Admin User	\N	2025-06-19 12:12:22.781989	\N	\N
7	1	\N	updated	medication	2	Updated medication: Testing 5 for Admin User	\N	2025-06-19 12:21:15.204773	\N	\N
5	1	1	created	medication	5	New medication: delete for Admin User	null	2025-06-19 12:14:01.134065	\N	\N
6	1	1	updated	medication	5	Updated medication: delete for Admin User	null	2025-06-19 12:14:13.731037	\N	\N
8	1	1	deleted	medication	5	Deleted medication: delete for Admin User	null	2025-06-19 12:59:51.250913	\N	\N
9	1	\N	created	practitioner	3	New practitioner: Dr Leo	null	2025-06-19 13:06:42.58189	\N	\N
10	1	1	updated	immunization	2	Updated immunization: Covid 19	\N	2025-06-19 15:42:13.060848	\N	\N
11	1	1	updated	treatment	1	Updated treatment: Unknown treatment	\N	2025-06-19 15:42:39.386309	\N	\N
12	1	1	updated	treatment	1	Updated treatment: Unknown treatment	\N	2025-06-19 16:54:30.945893	\N	\N
13	1	1	updated	treatment	1	Updated treatment: Chemo Therapy	\N	2025-06-19 18:43:39.525247	\N	\N
14	1	1	updated	immunization	2	Updated immunization: Covid 19	\N	2025-06-19 18:43:59.761617	\N	\N
15	1	1	updated	medication	2	Updated medication: Unknown medication	\N	2025-06-19 18:44:08.558738	\N	\N
16	1	2	created	encounter	1	New encounter: Test encounter for activity logging	\N	2025-06-19 18:47:14.200683	\N	\N
17	1	\N	created	practitioner	4	New practitioner: Dr. Test Activity	\N	2025-06-19 18:47:14.211545	\N	\N
18	1	2	created	encounter	2	New encounter: Test encounter for activity logging	\N	2025-06-19 18:48:03.080009	\N	\N
19	1	\N	created	practitioner	5	New practitioner: Dr. Test Activity	\N	2025-06-19 18:48:03.090406	\N	\N
20	1	2	created	encounter	3	New encounter: Test encounter for activity logging	\N	2025-06-19 18:48:13.147611	\N	\N
21	1	\N	created	practitioner	6	New practitioner: Dr. Test Activity	\N	2025-06-19 18:48:13.159125	\N	\N
22	1	2	created	encounter	4	New encounter: Test encounter for activity logging	\N	2025-06-19 18:48:56.541101	\N	\N
23	1	\N	created	practitioner	7	New practitioner: Dr. Test Activity	\N	2025-06-19 18:48:56.552648	\N	\N
24	1	2	created	lab_result_file	4	New lab result file: test_activity.pdf	\N	2025-06-19 18:48:56.567435	\N	\N
25	1	2	updated	encounter	4	Updated encounter: Test encounter for activity logging	\N	2025-06-19 18:48:56.581063	\N	\N
26	1	\N	updated	practitioner	7	Updated practitioner: Dr. Test Activity	\N	2025-06-19 18:48:56.590147	\N	\N
27	1	2	updated	lab_result_file	4	Updated lab result file: test_activity.pdf	\N	2025-06-19 18:48:56.598604	\N	\N
28	1	1	updated	allergy	1	Updated allergy: Peanut Butter	\N	2025-06-19 19:27:29.064322	\N	\N
29	1	1	updated	allergy	1	Updated allergy: Peanut Butter	\N	2025-06-19 19:27:31.66959	\N	\N
30	1	1	created	condition	1	New condition: Unknown condition	\N	2025-06-19 20:27:06.547901	\N	\N
31	1	1	created	medication	6	New medication: Unknown medication	\N	2025-06-19 20:41:05.745202	\N	\N
32	1	1	created	encounter	5	New encounter: Physical	\N	2025-06-19 21:31:46.409063	\N	\N
33	1	\N	deleted	user	2	Deleted user: test2k	null	2025-06-21 00:20:50.810641	\N	\N
34	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:42:10.163783	\N	\N
35	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:42:28.492943	\N	\N
36	1	1	updated	medication	2	Updated medication: Unknown medication	\N	2025-06-21 14:42:36.271573	\N	\N
37	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:42:53.612829	\N	\N
38	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:48:55.994169	\N	\N
39	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:49:52.262375	\N	\N
40	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:49:55.959186	\N	\N
41	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:51:37.881837	\N	\N
42	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:51:40.749717	\N	\N
43	1	1	updated	procedure	1	Updated procedure: Unknown procedure	\N	2025-06-21 14:52:06.392536	\N	\N
44	1	1	updated	procedure	1	Updated procedure: Unknown procedure	\N	2025-06-21 14:52:08.81655	\N	\N
45	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:53:49.457254	\N	\N
46	1	1	updated	medication	2	Updated medication: Unknown medication	\N	2025-06-21 14:53:53.390558	\N	\N
47	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:53:58.026352	\N	\N
48	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:57:12.022039	\N	\N
49	1	1	updated	medication	6	Updated medication: Unknown medication	\N	2025-06-21 14:59:38.09975	\N	\N
50	1	\N	created	pharmacy	1	New pharmacy: Harris Teeter	\N	2025-06-21 15:05:03.60096	\N	\N
51	1	1	updated	medication	2	Updated medication: Unknown medication	\N	2025-06-21 15:05:14.131996	\N	\N
52	1	1	updated	medication	2	Updated medication: Unknown medication	\N	2025-06-21 15:06:26.872249	\N	\N
53	1	\N	deleted	pharmacy	1	Deleted pharmacy: Harris Teeter	\N	2025-06-21 15:06:57.530267	\N	\N
54	1	1	deleted	medication	2	Deleted medication: Unknown medication	\N	2025-06-21 15:08:23.877469	\N	\N
55	1	1	created	medication	7	New medication: Unknown medication	\N	2025-06-21 15:08:44.584367	\N	\N
56	1	\N	created	pharmacy	2	New pharmacy: Teeter	\N	2025-06-21 15:20:07.148907	\N	\N
57	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:10:57.298143	\N	\N
58	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:11:02.77064	\N	\N
59	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:11:23.933593	\N	\N
60	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:11:59.37893	\N	\N
61	1	\N	created	pharmacy	3	New pharmacy: CVS - Main St	\N	2025-06-21 17:12:23.638642	\N	\N
62	1	1	updated	medication	7	Updated medication: Unknown medication	\N	2025-06-21 17:12:36.164231	\N	\N
63	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:12:43.750912	\N	\N
64	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:13:01.990262	\N	\N
65	1	\N	updated	pharmacy	3	Updated pharmacy: CVS - Main St	\N	2025-06-21 17:13:06.969053	\N	\N
66	1	\N	updated	pharmacy	3	Updated pharmacy: CVS - Main St	\N	2025-06-21 17:14:11.740763	\N	\N
67	1	\N	updated	pharmacy	3	Updated pharmacy: CVS - Main St	\N	2025-06-21 17:14:14.348253	\N	\N
68	1	\N	updated	pharmacy	3	Updated pharmacy: CVS - Mai	\N	2025-06-21 17:14:44.086413	\N	\N
69	1	\N	created	pharmacy	4	New pharmacy: Test	\N	2025-06-21 17:15:06.473666	\N	\N
70	1	\N	updated	pharmacy	4	Updated pharmacy: Test	\N	2025-06-21 17:15:10.450871	\N	\N
71	1	\N	deleted	pharmacy	4	Deleted pharmacy: Test	\N	2025-06-21 17:15:40.790065	\N	\N
72	1	\N	updated	pharmacy	2	Updated pharmacy: Teeter	\N	2025-06-21 17:16:32.635078	\N	\N
73	1	\N	updated	pharmacy	2	Updated pharmacy: Harris Teeter - Village Walk	\N	2025-06-21 17:16:43.264506	\N	\N
74	1	1	updated	medication	7	Updated medication: Unknown medication	\N	2025-06-21 17:16:53.607182	\N	\N
75	1	1	updated	lab_result	1	Updated lab result: Test FOo	\N	2025-06-21 23:10:23.83813	\N	\N
76	1	1	updated	medication	6	Updated medication	{}	2025-06-22 12:12:43.288576	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
77	1	1	updated	medication	6	Updated medication	{}	2025-06-22 12:12:54.99792	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
78	1	1	updated	medication	6	Updated medication: Advil	{}	2025-06-22 12:14:34.509974	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
79	1	1	updated	condition	1	Updated condition: Unknown condition	\N	2025-06-22 12:14:42.194144	\N	\N
80	1	1	updated	encounter	5	Updated encounter: Physical	\N	2025-06-22 12:15:05.293484	\N	\N
81	1	1	updated	encounter	5	Updated encounter: Physical	\N	2025-06-22 12:17:21.052598	\N	\N
82	1	1	created	encounter	6	New encounter: Pre-Op	\N	2025-06-22 12:17:58.915685	\N	\N
83	1	1	updated	encounter	5	Updated Visit: Physical on 2025-06-04	{}	2025-06-22 12:21:45.528696	\N	\N
84	1	1	updated	procedure	1	Updated Procedure: Fooo	{}	2025-06-22 12:55:20.632595	\N	\N
85	1	1	updated	medication	7	Updated Medication: Ozempic	{}	2025-06-22 12:55:29.63636	127.0.0.1	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36
86	1	1	created	lab_result	5	Created Lab Result: Testset	\N	2025-06-22 13:13:05.526345	\N	\N
87	1	1	updated	lab_result	5	Updated Lab Result: Testset	\N	2025-06-22 13:13:16.499955	\N	\N
88	1	1	updated	lab_result	5	Updated Lab Result: Testset	\N	2025-06-22 13:13:21.612458	\N	\N
89	1	1	created	lab_result	6	Created Lab Result: fdasfdsafdas	\N	2025-06-22 13:13:32.130281	\N	\N
90	1	1	updated	lab_result	6	Updated Lab Result: fdasfdsafdas	\N	2025-06-22 13:13:38.582015	\N	\N
91	1	1	updated	lab_result	6	Updated Lab Result: fdasfdsafdas	\N	2025-06-22 13:18:16.911061	\N	\N
92	1	1	updated	lab_result	6	Updated Lab Result: fdasfdsafdas	\N	2025-06-22 13:28:05.185844	\N	\N
93	1	1	deleted	procedure	1	Deleted Procedure: Fooo	\N	2025-06-22 14:04:27.378226	\N	\N
\.


--
-- TOC entry 3517 (class 0 OID 16385)
-- Dependencies: 217
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.alembic_version (version_num) FROM stdin;
d87e96e7e961
\.


--
-- TOC entry 3537 (class 0 OID 16550)
-- Dependencies: 237
-- Data for Name: allergies; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.allergies (id, patient_id, allergen, reaction, severity, onset_date, status, notes) FROM stdin;
1	1	Peanut Butter	Hives	severe	\N	active	\N
\.


--
-- TOC entry 3549 (class 0 OID 16673)
-- Dependencies: 249
-- Data for Name: backup_records; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.backup_records (id, backup_type, status, file_path, created_at, size_bytes, description, compression_used, checksum) FROM stdin;
1	database	failed	backups\\database_backup_20250623_173707.sql	2025-06-23 21:37:07.550111	\N	Failed backup: Database backup failed: [WinError 2] The system cannot find the file specified	f	\N
2	database	failed	backups\\database_backup_20250623_174535.sql	2025-06-23 21:45:42.859024	\N	Failed backup: Database backup failed: Unable to find image 'postgres:13' locally\n13: Pulling from library/postgres\n2c7c6491a802: Pulling fs layer\ned941eed5ed5: Pulling fs layer\n5134a3246f35: Pulling fs layer\n7ac5b010ec2a: Pulling fs layer\n2005b83b21e7: Pulling fs layer\n10cfa9828407: Pulling fs layer\nd9f01f25a3fa: Pulling fs layer\n232eedc21bf6: Pulling fs layer\n4e204015e10c: Pulling fs layer\nb24008789900: Pulling fs layer\n25eb195b2170: Pulling fs layer\n354b408f1ffe: Pulling fs layer\n0cc1af2d6f31: Pulling fs layer\n354b408f1ffe: Download complete\n7ac5b010ec2a: Download complete\ned941eed5ed5: Download complete\n5134a3246f35: Download complete\n10cfa9828407: Download complete\nd9f01f25a3fa: Download complete\n232eedc21bf6: Download complete\n354b408f1ffe: Pull complete\nb24008789900: Download complete\n2c7c6491a802: Download complete\n25eb195b2170: Download complete\n0cc1af2d6f31: Download complete\n0cc1af2d6f31: Pull complete\n4e204015e10c: Download complete\n25eb195b2170: Pull complete\n4e204015e10c: Pull complete\nd9f01f25a3fa: Pull complete\n2c7c6491a802: Pull complete\nb24008789900: Pull complete\n2005b83b21e7: Download complete\n7ac5b010ec2a: Pull complete\ned941eed5ed5: Pull complete\n5134a3246f35: Pull complete\n10cfa9828407: Pull complete\n232eedc21bf6: Pull complete\n2005b83b21e7: Pull complete\nDigest: sha256:e1195666dc3edf6c8447bea6df9d7bccfdda66ab927d1f68b1b6e0cc2262c232\nStatus: Downloaded newer image for postgres:13\npg_dump: error: server version: 17.5 (Debian 17.5-1.pgdg120+1); pg_dump version: 13.21 (Debian 13.21-1.pgdg120+1)\npg_dump: error: aborting because of server version mismatch\n	f	\N
\.


--
-- TOC entry 3531 (class 0 OID 16493)
-- Dependencies: 231
-- Data for Name: conditions; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.conditions (id, patient_id, practitioner_id, condition_name, diagnosis, notes, "onsetDate", status) FROM stdin;
1	1	\N	\N	Diabetes Type 2	\N	\N	resolved
\.


--
-- TOC entry 3527 (class 0 OID 16455)
-- Dependencies: 227
-- Data for Name: encounters; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.encounters (id, patient_id, practitioner_id, reason, date, notes) FROM stdin;
1	2	\N	Test encounter for activity logging	2025-06-19	This is a test encounter
2	2	\N	Test encounter for activity logging	2025-06-19	This is a test encounter
3	2	\N	Test encounter for activity logging	2025-06-19	This is a test encounter
4	2	\N	Test encounter for activity logging	2025-06-19	Updated notes for activity test
5	1	3	Physical	2025-06-04	\N
6	1	4	Pre-Op	2025-06-07	\N
\.


--
-- TOC entry 3533 (class 0 OID 16512)
-- Dependencies: 233
-- Data for Name: immunizations; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.immunizations (id, patient_id, practitioner_id, vaccine_name, date_administered, dose_number, lot_number, manufacturer, site, route, expiration_date, notes) FROM stdin;
2	1	\N	Covid 19	2025-06-02	\N	\N	\N	left_arm	intramuscular	\N	\N
\.


--
-- TOC entry 3539 (class 0 OID 16564)
-- Dependencies: 239
-- Data for Name: lab_result_files; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.lab_result_files (id, lab_result_id, file_name, file_path, file_type, file_size, description, uploaded_at) FROM stdin;
1	1	1000002550(1).jpg	uploads/lab_result_files\\f06d94f7-3979-4810-9813-850fbb3409b9.jpg	image/jpeg	169877	\N	2025-06-17 00:31:39.494318
4	4	test_activity.pdf	/uploads/test_activity.pdf	application/pdf	1024	Updated description for activity test	2025-06-19 18:48:56.561111
\.


--
-- TOC entry 3529 (class 0 OID 16474)
-- Dependencies: 229
-- Data for Name: lab_results; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.lab_results (id, patient_id, practitioner_id, test_name, test_code, test_category, test_type, facility, status, ordered_date, completed_date, notes, created_at, updated_at, labs_result) FROM stdin;
2	2	\N	Test Activity Lab	\N	\N	\N	\N	completed	2025-06-19 14:48:03.094665	2025-06-19 14:48:03.094667	\N	\N	\N	\N
3	2	\N	Test Activity Lab	\N	\N	\N	\N	completed	2025-06-19 14:48:13.163821	2025-06-19 14:48:13.163822	\N	\N	\N	\N
4	2	\N	Test Activity Lab	\N	\N	\N	\N	completed	2025-06-19 14:48:56.556878	2025-06-19 14:48:56.55688	\N	\N	\N	\N
1	1	2	Test FOo					completed	2025-06-10 20:00:00	\N		2025-06-16 22:39:07.343459	2025-06-21 23:10:23.831886	normal
5	1	5	Testset		imaging	urgent		cancelled	2025-06-22 21:13:00	\N		2025-06-22 13:13:05.520151	2025-06-22 13:13:21.607594	critical
6	1	5	fdasfdsafdas		imaging			ordered	2025-06-23 01:13:00	\N		2025-06-22 13:13:32.12558	2025-06-22 13:28:05.180237	
\.


--
-- TOC entry 3525 (class 0 OID 16436)
-- Dependencies: 225
-- Data for Name: medications; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.medications (id, medication_name, dosage, frequency, route, indication, "effectivePeriod_start", "effectivePeriod_end", status, patient_id, practitioner_id, pharmacy_id) FROM stdin;
6	Advil	1 tab	Daily	oral	Headaches	2025-06-02	\N	active	1	\N	2
7	Ozempic	1 ML	Weekly	injection	\N	2025-06-01	\N	active	1	2	2
\.


--
-- TOC entry 3523 (class 0 OID 16417)
-- Dependencies: 223
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.patients (id, user_id, first_name, last_name, "birthDate", physician_id, "bloodType", height, weight, gender, address) FROM stdin;
2	2	First Name	Last Name	1990-01-01	\N	\N	\N	\N	OTHER	Please update your address
3	5	First Name	Last Name	1990-01-01	\N	\N	\N	\N	OTHER	Please update your address
1	1	Admin	User	1990-01-01	2	\N	\N	\N	OTHER	Please update your address
4	6	First Name	Last Name	1990-01-01	\N	\N	\N	\N	OTHER	Please update your address
\.


--
-- TOC entry 3547 (class 0 OID 16647)
-- Dependencies: 247
-- Data for Name: pharmacies; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.pharmacies (id, name, phone_number, email, website, brand, street_address, city, state, zip_code, country, store_number, fax_number, hours, drive_through, twenty_four_hour, specialty_services, created_at, updated_at) FROM stdin;
3	CVS - Mai	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	f	\N	2025-06-21 17:12:23.633931	2025-06-21 17:14:44.082648
2	Harris Teeter - Village Walk	\N	\N	\N	Kroger	\N	Holly Springs	\N	\N	\N	\N	\N	\N	f	f	\N	2025-06-21 15:20:07.141965	2025-06-21 17:16:43.251345
\.


--
-- TOC entry 3521 (class 0 OID 16408)
-- Dependencies: 221
-- Data for Name: practitioners; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.practitioners (id, name, specialty, practice, phone_number, website, rating) FROM stdin;
4	Dr. Test Activity	General Medicine	Test Medical Center	5550123000	\N	\N
5	Dr. Test Activity	General Medicine	Test Medical Center	5550123000	\N	\N
6	Dr. Test Activity	General Medicine	Test Medical Center	5550123000	\N	\N
7	Dr. Test Activity	General Medicine	Test Medical Center	5559999000	\N	\N
3	Dr Leo	Being a Cat	Cat Inc	0000000000	\N	\N
2	Dr. Foo	Foobar	Foobar Place	8888888888	https://www.example.com	1
\.


--
-- TOC entry 3535 (class 0 OID 16531)
-- Dependencies: 235
-- Data for Name: procedures; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.procedures (id, patient_id, practitioner_id, procedure_name, code, date, description, status, notes, facility) FROM stdin;
\.


--
-- TOC entry 3541 (class 0 OID 16578)
-- Dependencies: 241
-- Data for Name: treatments; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.treatments (id, patient_id, practitioner_id, condition_id, treatment_name, treatment_type, start_date, end_date, status, treatment_category, notes, frequency, outcome, description, location) FROM stdin;
1	1	\N	\N	Chemo Therapy	Medication	2025-06-05	2025-06-19	on-hold	\N	\N	\N	\N		\N
\.


--
-- TOC entry 3519 (class 0 OID 16395)
-- Dependencies: 219
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.users (id, username, email, password_hash, full_name, role, created_at, updated_at) FROM stdin;
2	test	test@example.com	$2b$12$05sktH4RGXIilH2rsZ.XcOD6H0v/3vxCfav1oYjqbDAg.uoIDFsCi	test2k	user	2025-06-17 22:38:59.046779	2025-06-17 22:38:59.046783
5	test2	test2@example.com	$2b$12$O70TrQM2Ng0R/7Zwm.pdUuy1p/M1gY/cBZqsJ0o.9sfwu620Nqt7i	test	admin	2025-06-17 22:41:59.127261	2025-06-17 22:42:30.020917
6	testing	testing@testing.com	$2b$12$Dq1A6oRVwRg44YKncf8axe/A/GSZzOFnu8L5CJbBPBKzQzCxGpQ0W	testing	user	2025-06-20 00:38:56.138054	2025-06-20 00:38:56.138058
1	admin	admin@example.com	$2b$12$kxklqHGRJ7iYCIvvrrJ82.rQvz7sQ3DYmQ1A90kW.sczAI4cfKGBq	Admin	admin	2025-06-16 00:36:31.238182	2025-06-22 14:33:05.328566
\.


--
-- TOC entry 3545 (class 0 OID 16628)
-- Dependencies: 245
-- Data for Name: vitals; Type: TABLE DATA; Schema: public; Owner: user
--

COPY public.vitals (id, patient_id, practitioner_id, recorded_date, systolic_bp, diastolic_bp, heart_rate, temperature, weight, height, oxygen_saturation, respiratory_rate, blood_glucose, bmi, pain_scale, notes, location, device_used, created_at, updated_at) FROM stdin;
6	1	\N	2025-06-16 00:00:00	\N	\N	\N	\N	85	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-06-18 00:44:29.525477	2025-06-18 00:46:44.391171
5	1	\N	2025-06-03 00:00:00	\N	\N	\N	\N	105	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-06-18 00:44:21.998563	2025-06-18 00:46:52.286281
4	1	\N	2025-06-17 00:00:00	\N	\N	\N	\N	35.5	\N	\N	\N	\N	\N	\N	\N	\N	\N	2025-06-17 23:40:38.282259	2025-06-18 00:49:00.640783
7	1	\N	2025-06-18 00:00:00	113	61	\N	\N	270	74	\N	\N	\N	34.7	\N	\N	\N	\N	2025-06-18 00:44:34.485217	2025-06-18 01:09:20.259128
\.


--
-- TOC entry 3571 (class 0 OID 0)
-- Dependencies: 242
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 93, true);


--
-- TOC entry 3572 (class 0 OID 0)
-- Dependencies: 236
-- Name: allergies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.allergies_id_seq', 1, true);


--
-- TOC entry 3573 (class 0 OID 0)
-- Dependencies: 248
-- Name: backup_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.backup_records_id_seq', 2, true);


--
-- TOC entry 3574 (class 0 OID 0)
-- Dependencies: 230
-- Name: conditions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.conditions_id_seq', 1, true);


--
-- TOC entry 3575 (class 0 OID 0)
-- Dependencies: 226
-- Name: encounters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.encounters_id_seq', 6, true);


--
-- TOC entry 3576 (class 0 OID 0)
-- Dependencies: 232
-- Name: immunizations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.immunizations_id_seq', 2, true);


--
-- TOC entry 3577 (class 0 OID 0)
-- Dependencies: 238
-- Name: lab_result_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.lab_result_files_id_seq', 4, true);


--
-- TOC entry 3578 (class 0 OID 0)
-- Dependencies: 228
-- Name: lab_results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.lab_results_id_seq', 6, true);


--
-- TOC entry 3579 (class 0 OID 0)
-- Dependencies: 224
-- Name: medications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.medications_id_seq', 7, true);


--
-- TOC entry 3580 (class 0 OID 0)
-- Dependencies: 222
-- Name: patients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.patients_id_seq', 4, true);


--
-- TOC entry 3581 (class 0 OID 0)
-- Dependencies: 246
-- Name: pharmacies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.pharmacies_id_seq', 4, true);


--
-- TOC entry 3582 (class 0 OID 0)
-- Dependencies: 220
-- Name: practitioners_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.practitioners_id_seq', 7, true);


--
-- TOC entry 3583 (class 0 OID 0)
-- Dependencies: 234
-- Name: procedures_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.procedures_id_seq', 1, true);


--
-- TOC entry 3584 (class 0 OID 0)
-- Dependencies: 240
-- Name: treatments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.treatments_id_seq', 1, true);


--
-- TOC entry 3585 (class 0 OID 0)
-- Dependencies: 218
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.users_id_seq', 6, true);


--
-- TOC entry 3586 (class 0 OID 0)
-- Dependencies: 244
-- Name: vitals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: user
--

SELECT pg_catalog.setval('public.vitals_id_seq', 7, true);


--
-- TOC entry 3336 (class 2606 OID 16611)
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 3306 (class 2606 OID 16389)
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- TOC entry 3330 (class 2606 OID 16557)
-- Name: allergies allergies_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_pkey PRIMARY KEY (id);


--
-- TOC entry 3347 (class 2606 OID 16680)
-- Name: backup_records backup_records_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.backup_records
    ADD CONSTRAINT backup_records_pkey PRIMARY KEY (id);


--
-- TOC entry 3324 (class 2606 OID 16500)
-- Name: conditions conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_pkey PRIMARY KEY (id);


--
-- TOC entry 3320 (class 2606 OID 16462)
-- Name: encounters encounters_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_pkey PRIMARY KEY (id);


--
-- TOC entry 3326 (class 2606 OID 16519)
-- Name: immunizations immunizations_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.immunizations
    ADD CONSTRAINT immunizations_pkey PRIMARY KEY (id);


--
-- TOC entry 3332 (class 2606 OID 16571)
-- Name: lab_result_files lab_result_files_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_result_files
    ADD CONSTRAINT lab_result_files_pkey PRIMARY KEY (id);


--
-- TOC entry 3322 (class 2606 OID 16481)
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (id);


--
-- TOC entry 3318 (class 2606 OID 16443)
-- Name: medications medications_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pkey PRIMARY KEY (id);


--
-- TOC entry 3316 (class 2606 OID 16424)
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- TOC entry 3345 (class 2606 OID 16654)
-- Name: pharmacies pharmacies_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.pharmacies
    ADD CONSTRAINT pharmacies_pkey PRIMARY KEY (id);


--
-- TOC entry 3314 (class 2606 OID 16415)
-- Name: practitioners practitioners_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.practitioners
    ADD CONSTRAINT practitioners_pkey PRIMARY KEY (id);


--
-- TOC entry 3328 (class 2606 OID 16538)
-- Name: procedures procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_pkey PRIMARY KEY (id);


--
-- TOC entry 3334 (class 2606 OID 16585)
-- Name: treatments treatments_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_pkey PRIMARY KEY (id);


--
-- TOC entry 3308 (class 2606 OID 16406)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3310 (class 2606 OID 16402)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3312 (class 2606 OID 16404)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3343 (class 2606 OID 16635)
-- Name: vitals vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_pkey PRIMARY KEY (id);


--
-- TOC entry 3337 (class 1259 OID 16622)
-- Name: idx_activity_action; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX idx_activity_action ON public.activity_logs USING btree (action);


--
-- TOC entry 3338 (class 1259 OID 16623)
-- Name: idx_activity_entity; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX idx_activity_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- TOC entry 3339 (class 1259 OID 16624)
-- Name: idx_activity_patient_timestamp; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX idx_activity_patient_timestamp ON public.activity_logs USING btree (patient_id, "timestamp");


--
-- TOC entry 3340 (class 1259 OID 16625)
-- Name: idx_activity_timestamp; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX idx_activity_timestamp ON public.activity_logs USING btree ("timestamp");


--
-- TOC entry 3341 (class 1259 OID 16626)
-- Name: idx_activity_user_timestamp; Type: INDEX; Schema: public; Owner: user
--

CREATE INDEX idx_activity_user_timestamp ON public.activity_logs USING btree (user_id, "timestamp");


--
-- TOC entry 3368 (class 2606 OID 16612)
-- Name: activity_logs activity_logs_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3369 (class 2606 OID 16617)
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3363 (class 2606 OID 16558)
-- Name: allergies allergies_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.allergies
    ADD CONSTRAINT allergies_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3357 (class 2606 OID 16501)
-- Name: conditions conditions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3358 (class 2606 OID 16506)
-- Name: conditions conditions_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.conditions
    ADD CONSTRAINT conditions_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3353 (class 2606 OID 16463)
-- Name: encounters encounters_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3354 (class 2606 OID 16468)
-- Name: encounters encounters_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.encounters
    ADD CONSTRAINT encounters_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3359 (class 2606 OID 16520)
-- Name: immunizations immunizations_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.immunizations
    ADD CONSTRAINT immunizations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3360 (class 2606 OID 16525)
-- Name: immunizations immunizations_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.immunizations
    ADD CONSTRAINT immunizations_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3364 (class 2606 OID 16572)
-- Name: lab_result_files lab_result_files_lab_result_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_result_files
    ADD CONSTRAINT lab_result_files_lab_result_id_fkey FOREIGN KEY (lab_result_id) REFERENCES public.lab_results(id);


--
-- TOC entry 3355 (class 2606 OID 16482)
-- Name: lab_results lab_results_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3356 (class 2606 OID 16487)
-- Name: lab_results lab_results_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3350 (class 2606 OID 16444)
-- Name: medications medications_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3351 (class 2606 OID 16655)
-- Name: medications medications_pharmacy_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_pharmacy_id_fkey FOREIGN KEY (pharmacy_id) REFERENCES public.pharmacies(id);


--
-- TOC entry 3352 (class 2606 OID 16449)
-- Name: medications medications_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.medications
    ADD CONSTRAINT medications_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3348 (class 2606 OID 16430)
-- Name: patients patients_physician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_physician_id_fkey FOREIGN KEY (physician_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3349 (class 2606 OID 16425)
-- Name: patients patients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3361 (class 2606 OID 16539)
-- Name: procedures procedures_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3362 (class 2606 OID 16544)
-- Name: procedures procedures_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.procedures
    ADD CONSTRAINT procedures_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3365 (class 2606 OID 16596)
-- Name: treatments treatments_condition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_condition_id_fkey FOREIGN KEY (condition_id) REFERENCES public.conditions(id);


--
-- TOC entry 3366 (class 2606 OID 16586)
-- Name: treatments treatments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3367 (class 2606 OID 16591)
-- Name: treatments treatments_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.treatments
    ADD CONSTRAINT treatments_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


--
-- TOC entry 3370 (class 2606 OID 16636)
-- Name: vitals vitals_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- TOC entry 3371 (class 2606 OID 16641)
-- Name: vitals vitals_practitioner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: user
--

ALTER TABLE ONLY public.vitals
    ADD CONSTRAINT vitals_practitioner_id_fkey FOREIGN KEY (practitioner_id) REFERENCES public.practitioners(id);


-- Completed on 2025-06-23 21:46:13 UTC

--
-- PostgreSQL database dump complete
--


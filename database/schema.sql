--
-- PostgreSQL database dump
--

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.4

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
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'scheduled', -- scheduled means requested but not yet confirmed by the receptionist
    'confirmed', -- confirmed by receptionist but not yet visited
    'visited', -- patient has visited the hospital but has not done the whole thing yet, not confirmed if he'd cancell it or complete it 
    'completed', -- it's complete and he paid it
    'cancelled' -- aborted appointment either before visit or after
);


--
-- Name: bill_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.bill_type AS ENUM (
    'appointment_bill',
    'admission_bill'
);


--
-- Name: creation_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.creation_method AS ENUM (
    'phone',
    'online',
    'in_person'
);


--
-- Name: employee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_type AS ENUM (
    'doctor',
    'internal_user',
    'nurse',
    'database_admin',
    'accountant',
    'manager',
    'janitor',
    'security_staff'
);


--
-- Name: health_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.health_state AS ENUM (
    'stable',
    'cured',
    'critical'
);


--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_status AS ENUM (
    'unread',
    'read',
    'archived'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'appointment_reminder',
    'appointment_confirmed',
    'appointment_cancelled',
    'prescription_ready',
    'admission_update',
    'bill_generated',
    'payment_reminder',
    'general_announcement'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'not_decided',
    'cash',
    'mobile_banking',
    'credit_card',
    'debit_card',
    'check',
    'bank_transfer'
);


--
-- Name: delete_external_user(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_external_user(p_external_user_id integer) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_patient_id INTEGER;
BEGIN
    -- Get the patient_id for the external user
    SELECT patient_id INTO v_patient_id
    FROM external_user
    WHERE external_user_id = p_external_user_id;
    
    -- Check if user exists
    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;
    
    -- Delete related data in the correct order (child tables first)
    -- 1. Delete notifications for this user
    DELETE FROM notification WHERE external_user_id = p_external_user_id;
    
    -- 2. Delete patient_access records for this user
    DELETE FROM patient_access WHERE external_user_id = p_external_user_id;
    
    -- 3. Delete the external_user record
    DELETE FROM external_user WHERE external_user_id = p_external_user_id;
    
    -- Note: Patient record is preserved for medical records and potential future use
    -- The patient record will remain in the database even after user account deletion
    
    -- Return true if deletion was successful
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback any partial deletions
        RAISE EXCEPTION 'Failed to delete user: %', SQLERRM;
END;
$$;


--
-- Name: register_external_user(character varying, character varying, character, character varying, character varying, date, character, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_external_user(p_username character varying, p_email character varying, p_password_hash character, p_phone character varying DEFAULT NULL::character varying, p_name character varying DEFAULT NULL::character varying, p_dob date DEFAULT NULL::date, p_sex character DEFAULT 'U'::bpchar, p_blood_type character DEFAULT 'UN'::bpchar) RETURNS TABLE(user_id integer, new_patient_id integer, result_message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_patient_id INTEGER;
    v_external_user_id INTEGER;
    v_patient_name VARCHAR(63);
    v_default_receptionist INTEGER;
BEGIN
    -- Validate required parameters
    IF p_username IS NULL OR p_email IS NULL OR p_password_hash IS NULL THEN
        RAISE EXCEPTION 'Username, email, and password are required';
    END IF;

    -- Check if username or email already exists
    IF EXISTS (SELECT 1 FROM external_user WHERE external_username = p_username OR external_user_email = p_email) THEN
        RAISE EXCEPTION 'Username or email already exists';
    END IF;

    -- Set patient name (use username if name not provided)
    v_patient_name := COALESCE(p_name, p_username);

    -- Get a default receptionist for creating the patient record
    SELECT emp_id INTO v_default_receptionist
    FROM internal_user
    LIMIT 1;

    IF v_default_receptionist IS NULL THEN
        RAISE EXCEPTION 'No internal user found to create patient record';
    END IF;

    -- Step 1: Create patient record
    INSERT INTO patient (
        patient_name,
        patient_email,
        patient_phone,
        patient_dob,
        patient_sex,
        patient_blood_type,
        created_by
    ) VALUES (
        v_patient_name,
        p_email,
        COALESCE(p_phone, 'NOT PROVIDED'),
        COALESCE(p_dob, '1900-01-01'::DATE),
        p_sex,
        TRIM(p_blood_type),
        v_default_receptionist
    ) RETURNING patient_id INTO v_patient_id;

    -- Step 2: Create external user account
    INSERT INTO external_user (
        external_username,
        external_user_email,
        external_user_password_hash,
        external_user_phone,
        patient_id
    ) VALUES (
        p_username,
        p_email,
        p_password_hash,
        p_phone,
        v_patient_id
    ) RETURNING external_user_id INTO v_external_user_id;

    -- Step 3: Create patient access record
    INSERT INTO patient_access (external_user_id, patient_id)
    VALUES (v_external_user_id, v_patient_id);

    -- Return success
    RETURN QUERY SELECT
        v_external_user_id,
        v_patient_id,
        'User registration successful'::TEXT;

END;
$$;


--
-- Name: update_external_user_profile(integer, character varying, character varying, date, character, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_external_user_profile(p_external_user_id integer, p_name character varying DEFAULT NULL::character varying, p_phone character varying DEFAULT NULL::character varying, p_dob date DEFAULT NULL::date, p_sex character DEFAULT NULL::bpchar, p_blood_type character DEFAULT NULL::bpchar) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_patient_id INTEGER;
BEGIN
    -- Get the patient_id for this external user
    SELECT patient_id INTO v_patient_id
    FROM external_user
    WHERE external_user_id = p_external_user_id;

    IF v_patient_id IS NULL THEN
        RAISE EXCEPTION 'External user not found';
    END IF;

    -- Update external_user phone if provided
    IF p_phone IS NOT NULL THEN
        UPDATE external_user 
        SET external_user_phone = p_phone 
        WHERE external_user_id = p_external_user_id;
    END IF;

    -- Call the patient update function for other fields
    RETURN update_patient_profile(v_patient_id, p_name, p_phone, p_dob, p_sex, p_blood_type);
END;
$$;


--
-- Name: update_patient_profile(integer, character varying, character varying, date, character, character); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_patient_profile(p_patient_id integer, p_name character varying DEFAULT NULL::character varying, p_phone character varying DEFAULT NULL::character varying, p_dob date DEFAULT NULL::date, p_sex character DEFAULT NULL::bpchar, p_blood_type character DEFAULT NULL::bpchar) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if patient exists
    IF NOT EXISTS (SELECT 1 FROM patient WHERE patient_id = p_patient_id) THEN
        RAISE EXCEPTION 'Patient not found';
    END IF;

    -- Update only the provided fields
    UPDATE patient
    SET
        patient_name = COALESCE(p_name, patient_name),
        patient_phone = COALESCE(p_phone, patient_phone),
        patient_dob = COALESCE(p_dob, patient_dob),
        patient_sex = COALESCE(p_sex, patient_sex),
        patient_blood_type = COALESCE(TRIM(p_blood_type), patient_blood_type)
    WHERE patient_id = p_patient_id;

    RETURN TRUE;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission (
    admission_id integer NOT NULL,
    branch_id integer NOT NULL,
    room_no integer NOT NULL,
    patient_id integer NOT NULL,
    health_state public.health_state NOT NULL,
    attending_doctor integer NOT NULL,
    attending_nurse integer NOT NULL,
    created_by_receptionist integer NOT NULL,
    admission_time timestamp without time zone DEFAULT now() NOT NULL,
    discharge_time timestamp without time zone,
    bill_id integer NOT NULL
);


--
-- Name: admission_admission_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_admission_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_admission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_admission_id_seq OWNED BY public.admission.admission_id;


--
-- Name: appointment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment (
    appointment_id integer NOT NULL,
    patient_id integer NOT NULL,
    doctor_id integer NOT NULL,
    visit_date date NOT NULL,
    schedule_no integer NOT NULL,
    serial_no integer NOT NULL,
    status public.appointment_status DEFAULT 'scheduled'::public.appointment_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    creation_method public.creation_method DEFAULT 'phone'::public.creation_method NOT NULL,
    created_by integer NOT NULL,
    bill_id integer
);


--
-- Name: appointment_appointment_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointment_appointment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointment_appointment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointment_appointment_id_seq OWNED BY public.appointment.appointment_id;


--
-- Name: bill; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill (
    bill_id integer NOT NULL,
    created_by integer NOT NULL,
    initial_amount numeric(12,2) DEFAULT 0 NOT NULL,
    discount numeric(12,2) DEFAULT 0 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    final_amount numeric(12,2) NOT NULL,
    due numeric(12,2) NOT NULL,
    payment_method public.payment_method DEFAULT 'not_decided'::public.payment_method NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    bill_type public.bill_type NOT NULL
);


--
-- Name: bill_bill_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bill_bill_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bill_bill_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bill_bill_id_seq OWNED BY public.bill.bill_id;


--
-- Name: branch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branch (
    branch_id integer NOT NULL,
    branch_name character varying(63) NOT NULL,
    branch_address text NOT NULL,
    branch_manager integer,
    branch_receptionist integer,
    branch_email character varying(255) NOT NULL,
    branch_hours text NOT NULL,
    google_map_link text
);


--
-- Name: branch_branch_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.branch_branch_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: branch_branch_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.branch_branch_id_seq OWNED BY public.branch.branch_id;


--
-- Name: department; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department (
    department_id integer NOT NULL,
    department_name character varying(63) NOT NULL,
    department_description text
);


--
-- Name: department_department_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_department_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: department_department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_department_id_seq OWNED BY public.department.department_id;


--
-- Name: doctor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor (
    emp_id integer NOT NULL,
    department_id integer NOT NULL,
    qualifications text,
    visit_charge numeric(10,2) NOT NULL,
    profile_url character varying(255)
);


--
-- Name: doctor_schedule; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedule (
    doctor_id integer NOT NULL,
    schedule_no integer NOT NULL,
    start_time time without time zone NOT NULL,
    finish_time time without time zone NOT NULL,
    week_day integer NOT NULL,
    branch_id integer NOT NULL
);


--
-- Name: drug; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug (
    drug_id integer NOT NULL,
    drug_name character varying(127) NOT NULL,
    drug_type_id integer NOT NULL,
    description text,
    unit_type text NOT NULL,
    unit_price numeric(10,2) NOT NULL
);


--
-- Name: drug_drug_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drug_drug_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drug_drug_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drug_drug_id_seq OWNED BY public.drug.drug_id;


--
-- Name: drug_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drug_type (
    drug_type_id integer NOT NULL,
    drug_type_name character varying(63) NOT NULL,
    tax_percentage numeric(5,2) NOT NULL
);


--
-- Name: drug_type_drug_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drug_type_drug_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drug_type_drug_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drug_type_drug_type_id_seq OWNED BY public.drug_type.drug_type_id;


--
-- Name: employee; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee (
    emp_id integer NOT NULL,
    emp_name character varying(63) NOT NULL,
    emp_manager integer,
    emp_phone character varying(14) NOT NULL,
    emp_email character varying(255) NOT NULL,
    emp_salary numeric(12,2) NOT NULL,
    emp_comm_pct numeric(5,2),
    branch_id integer NOT NULL,
    week_days character varying(13),
    experience text,
    emp_dob date NOT NULL,
    emp_address text NOT NULL,
    emp_type public.employee_type NOT NULL
);


--
-- Name: employee_emp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_emp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_emp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_emp_id_seq OWNED BY public.employee.emp_id;


--
-- Name: employee_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_shift (
    shift_id integer NOT NULL,
    emp_id integer NOT NULL
);


--
-- Name: external_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_user (
    external_user_id integer NOT NULL,
    external_username character varying(63) NOT NULL,
    external_user_email character varying(255) NOT NULL,
    external_user_password_hash character(60) NOT NULL,
    external_user_phone character varying(14),
    patient_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: external_user_external_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.external_user_external_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: external_user_external_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.external_user_external_user_id_seq OWNED BY public.external_user.external_user_id;


--
-- Name: internal_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.internal_user (
    emp_id integer NOT NULL,
    internal_username character varying(63) NOT NULL,
    internal_user_email character varying(255) NOT NULL,
    internal_user_password_hash character(60) NOT NULL
);


--
-- Name: manager; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manager (
    manager_id integer NOT NULL,
    manager_type character varying(31) NOT NULL
);


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification (
    notification_id integer NOT NULL,
    external_user_id integer NOT NULL,
    notification_type public.notification_type NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    status public.notification_status DEFAULT 'unread'::public.notification_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone,
    appointment_id integer,
    admission_id integer,
    bill_id integer,
    prescription_id integer,
    expires_at timestamp without time zone,
    scheduled_for timestamp without time zone
);


--
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_notification_id_seq OWNED BY public.notification.notification_id;


--
-- Name: nurse; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nurse (
    nurse_id integer NOT NULL,
    rank smallint NOT NULL,
    CONSTRAINT nurse_rank_check CHECK (((rank >= 1) AND (rank <= 5)))
);


--
-- Name: patient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient (
    patient_id integer NOT NULL,
    patient_name character varying(63) NOT NULL,
    patient_email character varying(255) NOT NULL,
    patient_phone character varying(14) NOT NULL,
    patient_dob date NOT NULL,
    patient_sex character(1) NOT NULL,
    patient_blood_type character(3) NOT NULL,
    creation_date timestamp without time zone DEFAULT now() NOT NULL,
    created_by integer NOT NULL
);


--
-- Name: patient_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patient_access (
    external_user_id integer NOT NULL,
    patient_id integer NOT NULL
);


--
-- Name: patient_patient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patient_patient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patient_patient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patient_patient_id_seq OWNED BY public.patient.patient_id;


--
-- Name: prescription; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription (
    prescription_id integer NOT NULL,
    appointment_id integer NOT NULL,
    diagnosis text NOT NULL,
    suggested_tests text,
    next_visit_date date,
    doctor_notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: prescription_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_item (
    prescription_id integer NOT NULL,
    drug_id integer NOT NULL,
    dosage character varying(63),
    frequency character varying(63),
    duration character varying(63),
    notes text
);


--
-- Name: prescription_prescription_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.prescription_prescription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: prescription_prescription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.prescription_prescription_id_seq OWNED BY public.prescription.prescription_id;


--
-- Name: provided_service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provided_service (
    service_id integer NOT NULL,
    branch_id integer NOT NULL
);


--
-- Name: room; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room (
    branch_id integer NOT NULL,
    room_no integer NOT NULL,
    room_type_id integer NOT NULL,
    no_of_beds integer NOT NULL,
    occupancy integer DEFAULT 0 NOT NULL
);


--
-- Name: room_type; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.room_type (
    room_type_id integer NOT NULL,
    type_description text NOT NULL,
    bed_cost numeric(10,2) NOT NULL
);


--
-- Name: room_type_room_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.room_type_room_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: room_type_room_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.room_type_room_type_id_seq OWNED BY public.room_type.room_type_id;


--
-- Name: service; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service (
    service_id integer NOT NULL,
    service_name character varying(63) NOT NULL,
    service_description text
);


--
-- Name: service_service_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_service_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_service_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_service_id_seq OWNED BY public.service.service_id;


--
-- Name: work_shift; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_shift (
    shift_id integer NOT NULL,
    shift_name character varying(31) NOT NULL,
    shift_start time without time zone NOT NULL,
    shift_end time without time zone NOT NULL
);


--
-- Name: work_shift_shift_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.work_shift_shift_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_shift_shift_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.work_shift_shift_id_seq OWNED BY public.work_shift.shift_id;


--
-- Name: admission admission_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission ALTER COLUMN admission_id SET DEFAULT nextval('public.admission_admission_id_seq'::regclass);


--
-- Name: appointment appointment_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment ALTER COLUMN appointment_id SET DEFAULT nextval('public.appointment_appointment_id_seq'::regclass);


--
-- Name: bill bill_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill ALTER COLUMN bill_id SET DEFAULT nextval('public.bill_bill_id_seq'::regclass);


--
-- Name: branch branch_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch ALTER COLUMN branch_id SET DEFAULT nextval('public.branch_branch_id_seq'::regclass);


--
-- Name: department department_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department ALTER COLUMN department_id SET DEFAULT nextval('public.department_department_id_seq'::regclass);


--
-- Name: drug drug_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug ALTER COLUMN drug_id SET DEFAULT nextval('public.drug_drug_id_seq'::regclass);


--
-- Name: drug_type drug_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_type ALTER COLUMN drug_type_id SET DEFAULT nextval('public.drug_type_drug_type_id_seq'::regclass);


--
-- Name: employee emp_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee ALTER COLUMN emp_id SET DEFAULT nextval('public.employee_emp_id_seq'::regclass);


--
-- Name: external_user external_user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user ALTER COLUMN external_user_id SET DEFAULT nextval('public.external_user_external_user_id_seq'::regclass);


--
-- Name: notification notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_notification_id_seq'::regclass);


--
-- Name: patient patient_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient ALTER COLUMN patient_id SET DEFAULT nextval('public.patient_patient_id_seq'::regclass);


--
-- Name: prescription prescription_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription ALTER COLUMN prescription_id SET DEFAULT nextval('public.prescription_prescription_id_seq'::regclass);


--
-- Name: room_type room_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type ALTER COLUMN room_type_id SET DEFAULT nextval('public.room_type_room_type_id_seq'::regclass);


--
-- Name: service service_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service ALTER COLUMN service_id SET DEFAULT nextval('public.service_service_id_seq'::regclass);


--
-- Name: work_shift shift_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shift ALTER COLUMN shift_id SET DEFAULT nextval('public.work_shift_shift_id_seq'::regclass);


--
-- Name: admission admission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_pkey PRIMARY KEY (admission_id);


--
-- Name: appointment appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_pkey PRIMARY KEY (appointment_id);


--
-- Name: bill bill_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill
    ADD CONSTRAINT bill_pkey PRIMARY KEY (bill_id);


--
-- Name: branch branch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_pkey PRIMARY KEY (branch_id);


--
-- Name: department department_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department
    ADD CONSTRAINT department_pkey PRIMARY KEY (department_id);


--
-- Name: doctor doctor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_pkey PRIMARY KEY (emp_id);


--
-- Name: doctor_schedule doctor_schedule_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule
    ADD CONSTRAINT doctor_schedule_pkey PRIMARY KEY (doctor_id, schedule_no);


--
-- Name: drug drug_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug
    ADD CONSTRAINT drug_pkey PRIMARY KEY (drug_id);


--
-- Name: drug_type drug_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug_type
    ADD CONSTRAINT drug_type_pkey PRIMARY KEY (drug_type_id);


--
-- Name: employee employee_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_pkey PRIMARY KEY (emp_id);


--
-- Name: employee_shift employee_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shift
    ADD CONSTRAINT employee_shift_pkey PRIMARY KEY (shift_id, emp_id);


--
-- Name: external_user external_user_external_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user
    ADD CONSTRAINT external_user_external_user_email_key UNIQUE (external_user_email);


--
-- Name: external_user external_user_external_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user
    ADD CONSTRAINT external_user_external_username_key UNIQUE (external_username);


--
-- Name: external_user external_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user
    ADD CONSTRAINT external_user_pkey PRIMARY KEY (external_user_id);


--
-- Name: internal_user internal_user_internal_username_internal_user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_user
    ADD CONSTRAINT internal_user_internal_username_internal_user_email_key UNIQUE (internal_username, internal_user_email);


--
-- Name: internal_user internal_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_user
    ADD CONSTRAINT internal_user_pkey PRIMARY KEY (emp_id);


--
-- Name: manager manager_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager
    ADD CONSTRAINT manager_pkey PRIMARY KEY (manager_id);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (notification_id);


--
-- Name: nurse nurse_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse
    ADD CONSTRAINT nurse_pkey PRIMARY KEY (nurse_id);


--
-- Name: patient_access patient_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_pkey PRIMARY KEY (external_user_id, patient_id);


--
-- Name: patient patient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_pkey PRIMARY KEY (patient_id);


--
-- Name: prescription prescription_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription
    ADD CONSTRAINT prescription_appointment_id_key UNIQUE (appointment_id);


--
-- Name: prescription_item prescription_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_item
    ADD CONSTRAINT prescription_item_pkey PRIMARY KEY (prescription_id, drug_id);


--
-- Name: prescription prescription_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription
    ADD CONSTRAINT prescription_pkey PRIMARY KEY (prescription_id);


--
-- Name: provided_service provided_service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provided_service
    ADD CONSTRAINT provided_service_pkey PRIMARY KEY (service_id, branch_id);


--
-- Name: room room_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room
    ADD CONSTRAINT room_pkey PRIMARY KEY (branch_id, room_no);


--
-- Name: room_type room_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room_type
    ADD CONSTRAINT room_type_pkey PRIMARY KEY (room_type_id);


--
-- Name: service service_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service
    ADD CONSTRAINT service_pkey PRIMARY KEY (service_id);


--
-- Name: work_shift work_shift_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_shift
    ADD CONSTRAINT work_shift_pkey PRIMARY KEY (shift_id);


--
-- Name: idx_notification_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_created_at ON public.notification USING btree (created_at DESC);


--
-- Name: idx_notification_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_scheduled ON public.notification USING btree (scheduled_for) WHERE (scheduled_for IS NOT NULL);


--
-- Name: idx_notification_user_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_user_status ON public.notification USING btree (external_user_id, status);


--
-- Name: admission admission_attending_doctor_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_attending_doctor_fkey FOREIGN KEY (attending_doctor) REFERENCES public.doctor(emp_id);


--
-- Name: admission admission_attending_nurse_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_attending_nurse_fkey FOREIGN KEY (attending_nurse) REFERENCES public.nurse(nurse_id);


--
-- Name: admission admission_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bill(bill_id);


--
-- Name: admission admission_branch_id_room_no_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_branch_id_room_no_fkey FOREIGN KEY (branch_id, room_no) REFERENCES public.room(branch_id, room_no);


--
-- Name: admission admission_created_by_receptionist_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_created_by_receptionist_fkey FOREIGN KEY (created_by_receptionist) REFERENCES public.internal_user(emp_id);


--
-- Name: admission admission_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission
    ADD CONSTRAINT admission_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id);


--
-- Name: appointment appointment_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bill(bill_id);


--
-- Name: appointment appointment_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_user(emp_id);


--
-- Name: appointment appointment_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(emp_id);


--
-- Name: appointment appointment_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment
    ADD CONSTRAINT appointment_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id);


--
-- Name: bill bill_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill
    ADD CONSTRAINT bill_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_user(emp_id);


--
-- Name: branch branch_manager_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_manager_fk FOREIGN KEY (branch_manager) REFERENCES public.manager(manager_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: branch branch_receptionist_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branch
    ADD CONSTRAINT branch_receptionist_fk FOREIGN KEY (branch_receptionist) REFERENCES public.internal_user(emp_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: doctor doctor_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.department(department_id);


--
-- Name: doctor doctor_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor
    ADD CONSTRAINT doctor_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.employee(emp_id);


--
-- Name: doctor_schedule doctor_schedule_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule
    ADD CONSTRAINT doctor_schedule_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id);


--
-- Name: doctor_schedule doctor_schedule_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedule
    ADD CONSTRAINT doctor_schedule_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctor(emp_id);


--
-- Name: drug drug_drug_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drug
    ADD CONSTRAINT drug_drug_type_id_fkey FOREIGN KEY (drug_type_id) REFERENCES public.drug_type(drug_type_id);


--
-- Name: employee employee_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id);


--
-- Name: employee employee_manager_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee
    ADD CONSTRAINT employee_manager_fk FOREIGN KEY (emp_manager) REFERENCES public.manager(manager_id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: employee_shift employee_shift_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shift
    ADD CONSTRAINT employee_shift_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.employee(emp_id);


--
-- Name: employee_shift employee_shift_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shift
    ADD CONSTRAINT employee_shift_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.work_shift(shift_id);


--
-- Name: external_user external_user_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_user
    ADD CONSTRAINT external_user_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id);


--
-- Name: internal_user internal_user_emp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.internal_user
    ADD CONSTRAINT internal_user_emp_id_fkey FOREIGN KEY (emp_id) REFERENCES public.employee(emp_id);


--
-- Name: manager manager_manager_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manager
    ADD CONSTRAINT manager_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES public.employee(emp_id);


--
-- Name: notification notification_admission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_admission_id_fkey FOREIGN KEY (admission_id) REFERENCES public.admission(admission_id);


--
-- Name: notification notification_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointment(appointment_id);


--
-- Name: notification notification_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bill(bill_id);


--
-- Name: notification notification_external_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_external_user_id_fkey FOREIGN KEY (external_user_id) REFERENCES public.external_user(external_user_id) ON DELETE CASCADE;


--
-- Name: notification notification_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescription(prescription_id);


--
-- Name: nurse nurse_nurse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nurse
    ADD CONSTRAINT nurse_nurse_id_fkey FOREIGN KEY (nurse_id) REFERENCES public.employee(emp_id);


--
-- Name: patient_access patient_access_external_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_external_user_id_fkey FOREIGN KEY (external_user_id) REFERENCES public.external_user(external_user_id) ON DELETE CASCADE;


--
-- Name: patient_access patient_access_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient_access
    ADD CONSTRAINT patient_access_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patient(patient_id) ON DELETE CASCADE;


--
-- Name: patient patient_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patient
    ADD CONSTRAINT patient_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.internal_user(emp_id);


--
-- Name: prescription prescription_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription
    ADD CONSTRAINT prescription_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointment(appointment_id);


--
-- Name: prescription_item prescription_item_drug_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_item
    ADD CONSTRAINT prescription_item_drug_id_fkey FOREIGN KEY (drug_id) REFERENCES public.drug(drug_id);


--
-- Name: prescription_item prescription_item_prescription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_item
    ADD CONSTRAINT prescription_item_prescription_id_fkey FOREIGN KEY (prescription_id) REFERENCES public.prescription(prescription_id);


--
-- Name: provided_service provided_service_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provided_service
    ADD CONSTRAINT provided_service_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id);


--
-- Name: provided_service provided_service_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provided_service
    ADD CONSTRAINT provided_service_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.service(service_id);


--
-- Name: room room_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room
    ADD CONSTRAINT room_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branch(branch_id);


--
-- Name: room room_room_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.room
    ADD CONSTRAINT room_room_type_id_fkey FOREIGN KEY (room_type_id) REFERENCES public.room_type(room_type_id);


--
-- PostgreSQL database dump complete
--


-- Drop existing tables and views if they exist
DROP VIEW IF EXISTS public.institutes_with_users;
DROP TABLE IF EXISTS public.tests CASCADE;
DROP TABLE IF EXISTS public.mcqs CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.institutes CASCADE;

-- Create Institutes Table
CREATE TABLE IF NOT EXISTS public.institutes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT institutes_pkey PRIMARY KEY (id)
);

-- Create Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    name character varying,
    email character varying,
    role character varying,
    institute_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE SET NULL
);

-- Create MCQs Table
CREATE TABLE IF NOT EXISTS public.mcqs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    question text NOT NULL,
    type text NOT NULL,
    options jsonb,
    answer text NOT NULL,
    explanation text,
    "diagramDescription" text,
    "diagramSvg" text,
    subject text NOT NULL,
    topic text,
    difficulty text,
    marks integer,
    "isFlagged" boolean DEFAULT false,
    "flagReason" text,
    "createdAt" timestamptz DEFAULT now(),
    "updatedAt" timestamptz DEFAULT now(),
    CONSTRAINT mcqs_pkey PRIMARY KEY (id)
);

-- Create Tests Table
CREATE TABLE IF NOT EXISTS public.tests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title character varying NOT NULL,
    duration integer,
    institute_id uuid,
    question_ids uuid[],
    total_marks integer,
    date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tests_pkey PRIMARY KEY (id),
    CONSTRAINT tests_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id) ON DELETE CASCADE
);

-- Create View to Combine Institutes and Users
CREATE OR REPLACE VIEW public.institutes_with_users AS
SELECT
    i.id,
    i.name,
    u.email,
    i.created_at
FROM
    public.institutes i
LEFT JOIN
    public.users u ON i.id = u.institute_id
WHERE
    u.role = 'institute';

-- Grant usage on the schema and select on the view
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.institutes_with_users TO postgres, anon, authenticated, service_role;
erDiagram
    users ||--o| employees : "has one"
    users ||--o{ onboarding_tasks : "assigns"
    users ||--o{ appraisals : "reviews"
    users ||--o{ leave_requests : "approves"
    employees ||--o{ employees : "manages"
    employees ||--o{ onboarding_tasks : "receives"
    employees ||--o{ appraisals : "receives"
    employees ||--o{ leave_requests : "submits"
    employees ||--o{ leave_balances : "has"

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        user_role role
        varchar first_name
        varchar last_name
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    employees {
        uuid id PK
        uuid user_id FK,UK
        varchar employee_number UK
        varchar department
        varchar position
        date hire_date
        uuid manager_id FK
        employee_status status
        timestamptz created_at
        timestamptz updated_at
    }

    onboarding_tasks {
        uuid id PK
        uuid employee_id FK
        varchar task_title
        text task_description
        uuid assigned_by FK
        date due_date
        onboarding_task_status status
        timestamptz completed_at
        varchar document_url
        timestamptz created_at
        timestamptz updated_at
    }

    appraisals {
        uuid id PK
        uuid employee_id FK
        uuid reviewer_id FK
        date review_period_start
        date review_period_end
        text self_assessment
        text manager_feedback
        integer rating
        jsonb goals
        appraisal_status status
        timestamptz created_at
        timestamptz updated_at
    }

    leave_requests {
        uuid id PK
        uuid employee_id FK
        leave_type leave_type
        date start_date
        date end_date
        decimal days_count
        text reason
        leave_status status
        uuid approved_by FK
        timestamptz approved_at
        timestamptz created_at
        timestamptz updated_at
    }

    leave_balances {
        uuid id PK
        uuid employee_id FK
        decimal annual_leave_total
        decimal annual_leave_used
        decimal sick_leave_total
        decimal sick_leave_used
        integer year
        timestamptz created_at
        timestamptz updated_at
    }
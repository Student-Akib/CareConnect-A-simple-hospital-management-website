# Database Setup for Profile System

This directory contains the database functions needed for the user profile system.

## Setup Instructions

1. **Create the database function:**
   ```sql
   -- Run the functions.sql file in your PostgreSQL database
   psql -d your_database_name -f functions.sql
   ```

2. **Verify the function was created:**
   ```sql
   -- Check if the function exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name = 'update_patient_profile';
   ```

## Functions

### `update_patient_profile(p_external_user_id, p_name, p_phone, p_dob, p_sex, p_blood_type)`

This function updates a patient's profile information based on their external user ID.

**Parameters:**
- `p_external_user_id` (INTEGER): The external user ID
- `p_name` (VARCHAR(63)): Patient's full name (optional)
- `p_phone` (VARCHAR(14)): Patient's phone number (optional)
- `p_dob` (DATE): Patient's date of birth (optional)
- `p_sex` (CHAR(1)): Patient's sex - 'M', 'F', or 'O' (optional)
- `p_blood_type` (CHAR(3)): Patient's blood type (optional)

**Returns:** BOOLEAN - true if update was successful, false otherwise

**Validation:**
- User must exist in the external_user table
- Name and phone cannot be empty strings if provided
- Sex must be 'M', 'F', or 'O'
- Blood type must be one of the valid types: 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'

**Usage Example:**
```sql
SELECT update_patient_profile(1, 'John Doe', '123-456-7890', '1990-01-01', 'M', 'O+');
```

## Tables Required

The function requires the following tables to exist:

1. **external_user** - Contains user account information
2. **patient** - Contains patient medical information

The function links these tables via the `patient_id` foreign key in the `external_user` table. 
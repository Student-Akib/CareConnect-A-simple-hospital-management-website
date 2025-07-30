const fs = require('fs');
const { Pool } = require('pg');

// Create pool using the same configuration as db.js
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'hospital_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password'
});

async function setupDatabase() {
    try {
        console.log('🔧 Setting up database functions...');
        
        // Read the appointment creation functions
        const functionsPath = '../database/appointment_creation_functions.sql';
        if (!fs.existsSync(functionsPath)) {
            console.error('❌ Functions file not found:', functionsPath);
            console.log('Please make sure the file exists in the database folder.');
            return;
        }
        
        const sql = fs.readFileSync(functionsPath, 'utf8');
        console.log('📖 Read functions file successfully');
        
        // Execute the functions
        console.log('⚡ Executing PL/pgSQL functions...');
        await pool.query(sql);
        console.log('✅ Functions executed successfully!');
        
        // Verify the functions were created
        console.log('🔍 Verifying functions...');
        const result = await pool.query(`
            SELECT routine_name, routine_type 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND routine_name IN (
                'get_all_doctors',
                'get_doctor_details_with_schedule',
                'get_available_time_slots',
                'get_next_serial_number',
                'create_appointment_request'
            )
            AND routine_type = 'FUNCTION'
            ORDER BY routine_name;
        `);
        
        console.log('📋 Created functions:');
        if (result.rows.length === 0) {
            console.log('❌ No functions found!');
        } else {
            result.rows.forEach(row => {
                console.log(`✅ ${row.routine_name}`);
            });
        }
        
        console.log('\n🎉 Database setup complete!');
        console.log('You can now start the server and use the appointment creation feature.');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.log('\n💡 Troubleshooting tips:');
        console.log('1. Make sure PostgreSQL is running');
        console.log('2. Check your database connection settings in .env file');
        console.log('3. Ensure the database exists and is accessible');
        console.log('4. Verify you have the necessary permissions');
    } finally {
        await pool.end();
    }
}

// Run the setup
setupDatabase(); 
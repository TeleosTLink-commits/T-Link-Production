CREATE OR REPLACE VIEW test_methods_full AS
SELECT 
    tm.id,
    tm.legacy_number,
    tm.legacy_lab_source,
    tm.original_title,
    tm.official_number,
    tm.official_title,
    COALESCE(tm.official_title, tm.original_title) as display_title,
    COALESCE(tm.official_number, tm.legacy_number) as display_number,
    tm.status,
    tm.verification_status,
    tm.current_version,
    tm.method_type,
    cat.category_name,
    tm.effective_date,
    tm.next_review_date,
    u1.username as created_by_name,
    u2.username as verified_by_name,
    tm.verified_date,
    tm.created_at,
    tm.updated_at,
    COUNT(DISTINCT tmf.id) as file_count,
    COUNT(DISTINCT tmv.id) as version_count,
    CASE 
        WHEN tm.official_number IS NOT NULL THEN true
        ELSE false
    END as is_standardized
FROM test_methods tm
LEFT JOIN test_method_categories cat ON tm.category_id = cat.id
LEFT JOIN users u1 ON tm.created_by = u1.id
LEFT JOIN users u2 ON tm.verified_by = u2.id
LEFT JOIN test_method_files tmf ON tm.id = tmf.test_method_id
LEFT JOIN test_method_versions tmv ON tm.id = tmv.test_method_id
GROUP BY tm.id, cat.category_name, u1.username, u2.username;

-- Add video_urls column to cats table (missing from 001_initial_schema)
ALTER TABLE cats ADD COLUMN IF NOT EXISTS video_urls TEXT[] DEFAULT '{}';

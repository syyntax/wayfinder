-- Migration: Add cover_image columns to boards and cards tables
-- This migration adds support for cover images on both boards and cards

-- Add cover_image column to boards table
ALTER TABLE boards ADD COLUMN cover_image TEXT;

-- Add cover_image column to cards table
ALTER TABLE cards ADD COLUMN cover_image TEXT;

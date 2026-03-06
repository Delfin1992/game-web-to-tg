// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  city: text("city").notNull().default("Санкт-Петербург"),
  personality: text("personality").notNull().default("workaholic"),
  gender: text("gender").notNull().default("male"),
  level: integer("level").notNull().default(1),
  experience: integer("experience").notNull().default(0),
  balance: integer("balance").notNull().default(1000),
  reputation: integer("reputation").notNull().default(0),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  city: text("city").notNull(),
  ownerId: varchar("owner_id").notNull(),
  level: integer("level").notNull().default(1),
  ork: integer("ork").notNull().default(0),
  balance: integer("balance").notNull().default(1000),
  warehouseCapacity: integer("warehouse_capacity").notNull().default(50),
});

export const companyMembers = pgTable("company_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  role: text("role").notNull().default("member"),
});

export const companyJoinRequests = pgTable("company_join_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  status: text("status").notNull().default("pending"),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  username: text("username").notNull(),
  content: text("content").notNull(),
  timestamp: integer("timestamp").notNull().default(sql`extract(epoch from now())`),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  city: true,
  personality: true,
  gender: true,
});

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  city: true,
});

export const insertJoinRequestSchema = createInsertSchema(companyJoinRequests).pick({
  companyId: true,
  userId: true,
  username: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  userId: true,
  username: true,
  content: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = Partial<typeof users.$inferInsert>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type CompanyMember = typeof companyMembers.$inferSelect;
export type InsertCompanyMember = typeof companyMembers.$inferInsert;

export type JoinRequest = typeof companyJoinRequests.$inferSelect;
export type InsertJoinRequest = z.infer<typeof insertJoinRequestSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

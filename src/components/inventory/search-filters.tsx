"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterOptions, DRAWER_OPTIONS, CONDITION_CATEGORIES } from "@/lib/inventory-utils";

interface SearchFiltersProps {
  filters: FilterOptions;
  onChange: (filters: FilterOptions) => void;
}

export function SearchFilters({ filters, onChange }: SearchFiltersProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="relative">
        <Label htmlFor="search" className="sr-only">
          Search medications
        </Label>
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="search"
          placeholder="Search by name, NDC, or strength..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-10"
          aria-label="Search medications by name, NDC, or strength"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="class-filter">Class</Label>
          <Select
            value={filters.classFilter}
            onValueChange={(value) =>
              onChange({
                ...filters,
                classFilter: value as FilterOptions["classFilter"],
              })
            }
          >
            <SelectTrigger id="class-filter" aria-label="Filter by class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              <SelectItem value="Uncontrolled">Uncontrolled</SelectItem>
              <SelectItem value="Schedule III-V">Schedule III-V</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="stock-filter">Stock Status</Label>
          <Select
            value={filters.stockFilter}
            onValueChange={(value) =>
              onChange({
                ...filters,
                stockFilter: value as FilterOptions["stockFilter"],
              })
            }
          >
            <SelectTrigger id="stock-filter" aria-label="Filter by stock status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in-stock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="drawer-filter">Drawer</Label>
          <Select
            value={filters.drawerFilter}
            onValueChange={(value) =>
              onChange({ ...filters, drawerFilter: value })
            }
          >
            <SelectTrigger id="drawer-filter" aria-label="Filter by drawer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Drawers</SelectItem>
              {DRAWER_OPTIONS.map((drawer) => (
                <SelectItem key={drawer} value={drawer}>
                  Drawer {drawer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category-filter">Condition Category</Label>
          <Select
            value={filters.categoryFilter}
            onValueChange={(value) =>
              onChange({
                ...filters,
                categoryFilter: value as FilterOptions["categoryFilter"],
              })
            }
          >
            <SelectTrigger id="category-filter" aria-label="Filter by condition category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CONDITION_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

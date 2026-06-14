export interface PlantPhoto {
  id: string;
  plant_id: string;
  url: string;
  taken_at: string | null;
}

export interface Plant {
  id: string;
  user_id: string;
  common_name: string | null;
  genus: string | null;
  species: string | null;
  confidence: number | null;
  confirmed: boolean;
  acquired_at: string | null;
  is_public: boolean;
  for_trade: boolean;
  country: string | null;
  created_at: string;
  plant_photos: PlantPhoto[];
}

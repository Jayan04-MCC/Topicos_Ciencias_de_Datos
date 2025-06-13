import pandas as pd

# Load the original dataset
file_path = "data.csv"
df = pd.read_csv(file_path, encoding='ISO-8859-1')

# Create a filtered CSV with relevant columns for interactive visualization
df_filtered = df[['_golden', 'choose_one', 'choose_one:confidence', 'keyword', 'location','text']].copy()
# Ensure boolean for _golden, and consistent string values
df_filtered['_golden'] = df_filtered['_golden'].astype(bool)
# Save to a new CSV for D3.js visualizations
output_path = "tweets_interactivo.csv"
df_filtered.to_csv(output_path, index=False, encoding='utf-8')
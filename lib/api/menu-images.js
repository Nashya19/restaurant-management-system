import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'lib/data/menu_item_images.json');

function ensureDir() {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Load menu item image mappings from local JSON database
export function getMenuItemImages() {
  ensureDir();
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('Failed to read menu item images file:', e);
    return {};
  }
}

// Save or update an image URL mapping for a menu item
export function saveMenuItemImage(itemId, imageUrl) {
  ensureDir();
  const data = getMenuItemImages();
  data[itemId] = imageUrl;
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to write menu item image file:', e);
    return false;
  }
}

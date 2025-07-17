import Jimp from 'jimp';

// Replace pure black pixels (#000000) with white (#ffffff)
async function processImageReplaceBlackAndThicken(buffer: Buffer): Promise<Buffer> {
	const image = await Jimp.read(buffer);
	const width = image.bitmap.width;
	const height = image.bitmap.height;
	// Replace pure black with white
	image.scan(0, 0, width, height, function (_x, _y, idx) {
		const red = (this as any).bitmap.data[idx + 0];
		const green = (this as any).bitmap.data[idx + 1];
		const blue = (this as any).bitmap.data[idx + 2];
		if (red === 0 && green === 0 && blue === 0) {
			(this as any).bitmap.data[idx + 0] = 255;
			(this as any).bitmap.data[idx + 1] = 255;
			(this as any).bitmap.data[idx + 2] = 255;
		}
	});
	return image.getBufferAsync(Jimp.MIME_PNG);
}

// Image processing functions
async function processImageWithJimpWhiteBackground(buffer: Buffer): Promise<Buffer> {
	const image = await Jimp.read(buffer);
	const width = image.bitmap.width;
	const height = image.bitmap.height;

	// Make everything white background
	image.scan(0, 0, width, height, function (_x: any, _y: any, idx: any) {
		const red = (this as any).bitmap.data[idx + 0];
		const green = (this as any).bitmap.data[idx + 1];
		const blue = (this as any).bitmap.data[idx + 2];

		const brightness = (red + green + blue) / 3;

		if (brightness < 150) {
			// Darker pixels (text and lines) -> black
			(this as any).bitmap.data[idx + 0] = 0;
			(this as any).bitmap.data[idx + 1] = 0;
			(this as any).bitmap.data[idx + 2] = 0;
		} else {
			// Light pixels (background) -> white
			(this as any).bitmap.data[idx + 0] = 255;
			(this as any).bitmap.data[idx + 1] = 255;
			(this as any).bitmap.data[idx + 2] = 255;
		}
	});

	return image.resize(300, 90).contrast(0.3).greyscale().normalize().getBufferAsync(Jimp.MIME_PNG);
}

async function processImageWithJimpBlackBackground(buffer: Buffer): Promise<Buffer> {
	const image = await Jimp.read(buffer);
	const width = image.bitmap.width;
	const height = image.bitmap.height;

	// First process like white background
	image.scan(0, 0, width, height, function (_x: any, _y: any, idx: any) {
		const red = (this as any).bitmap.data[idx + 0];
		const green = (this as any).bitmap.data[idx + 1];
		const blue = (this as any).bitmap.data[idx + 2];

		const brightness = (red + green + blue) / 3;

		if (brightness < 150) {
			// Darker pixels (text and lines) -> black
			(this as any).bitmap.data[idx + 0] = 0;
			(this as any).bitmap.data[idx + 1] = 0;
			(this as any).bitmap.data[idx + 2] = 0;
		} else {
			// Light pixels (background) -> white
			(this as any).bitmap.data[idx + 0] = 255;
			(this as any).bitmap.data[idx + 1] = 255;
			(this as any).bitmap.data[idx + 2] = 255;
		}
	});

	// Apply processing
	const processedImage = image.resize(300, 90).contrast(0.3).greyscale().normalize();

	// Invert colors (white <-> black)
	return processedImage.invert().getBufferAsync(Jimp.MIME_PNG);
}

export {
	processImageReplaceBlackAndThicken,
	processImageWithJimpWhiteBackground,
	processImageWithJimpBlackBackground,
};

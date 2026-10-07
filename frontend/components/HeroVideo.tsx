export const HeroVideo = () => {
  return (
    <div className="container-content flex justify-center">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-neutral-200 shadow-soft-lg">
        <video
          src="https://res.cloudinary.com/zapier-media/video/upload/f_auto,q_auto/v1706042175/Homepage%20ZAP%20Jan%2024/012324_Homepage_Hero1_1920x1080_pwkvu4.mp4"
          className="w-full"
          controls={false}
          muted
          autoPlay
          playsInline
          aria-label="Product demo video"
        />
      </div>
    </div>
  );
};
